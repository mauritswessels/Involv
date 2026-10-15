import { useState, useEffect, useRef } from 'react';
import { actionError } from '../utils/actionError';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, CheckSquareIcon, MessageSquareIcon, XIcon } from 'lucide-react';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { getOrganizerOpportunities } from '../services/opportunityService';
import { getOpportunityApplications, updateApplicationStatus } from '../services/applicationService';
import type { Application, ApplicationStatus, Opportunity } from '../types';
import { logSafeError } from '../utils/safeConsole';

type FilterTab = 'All' | ApplicationStatus;

const TABS: FilterTab[] = ['All', 'Pending', 'Under Review', 'Accepted', 'Rejected'];

export default function ApplicationsManagementPage() {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const { user } = useAuth();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const [viewApp, setViewApp] = useState<Application | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulking, setBulking] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const decisionBusy = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch the opportunity + its applications on mount
  useEffect(() => {
    if (!user || !opportunityId) return;
    setLoading(true);

    Promise.all([
      getOrganizerOpportunities(user.id).then(opps => opps.find(o => o.id === opportunityId) ?? null),
      getOpportunityApplications(opportunityId),
    ])
      .then(([opp, apps]) => {
        setOpportunity(opp);
        setApplications(apps);
      })
      .catch(err => { logSafeError('[Applications] failed to load', err); setLoadError(actionError(err, 'load')); })
      .finally(() => setLoading(false));
  }, [user?.id, opportunityId]);

  const updateStatus = async (id: string, status: ApplicationStatus) => {
    if (decisionBusy.current) return;
    decisionBusy.current = true; setDeciding(true); setDecisionError(null);
    try {
      await updateApplicationStatus(id, status);
      setApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      setViewApp(prev => prev?.id === id ? { ...prev, status } : prev);
    } catch (error) {
      logSafeError('[Applications] update status failed', error);
      setDecisionError(actionError(error, 'review'));
    } finally { decisionBusy.current = false; setDeciding(false); }
  };

  const handleBulkStatus = async (status: ApplicationStatus) => {
    if (selectedIds.size === 0 || decisionBusy.current) return;
    decisionBusy.current = true; setBulking(true); setDeciding(true); setDecisionError(null);
    const ids = [...selectedIds];
    try {
      const results = await Promise.allSettled(ids.map(id => updateApplicationStatus(id, status)));
      const confirmed = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
      setApplications(prev => prev.map(a => confirmed.has(a.id) ? { ...a, status } : a));
      setViewApp(prev => prev && confirmed.has(prev.id) ? { ...prev, status } : prev);
      setSelectedIds(prev => new Set([...prev].filter(id => !confirmed.has(id))));
      if (confirmed.size !== ids.length) {
        setDecisionError(`${confirmed.size} of ${ids.length} changes confirmed. The remaining decisions were not confirmed. Refresh before retrying.`);
      }
    } finally { decisionBusy.current = false; setBulking(false); setDeciding(false); }
  };

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtered =
    activeTab === 'All' ? applications : applications.filter(a => a.status === activeTab);

  const selectableFiltered = filtered.filter(a => a.status === 'Pending' || a.status === 'Under Review');
  const allSelected = selectableFiltered.length > 0 && selectableFiltered.every(a => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableFiltered.forEach(a => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableFiltered.forEach(a => next.add(a.id));
        return next;
      });
    }
  };

  const counts = {
    All: applications.length,
    Pending: applications.filter(a => a.status === 'Pending').length,
    'Under Review': applications.filter(a => a.status === 'Under Review').length,
    Accepted: applications.filter(a => a.status === 'Accepted').length,
    Rejected: applications.filter(a => a.status === 'Rejected').length,
  };

  if (loadError) return <div role="alert" className="max-w-xl mx-auto p-6 text-sm text-red-800">
    <p>{loadError}</p><button type="button" onClick={() => window.location.reload()} className="btn-secondary mt-3">Retry loading</button>
  </div>;
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-sm text-slate-600 mb-4">Opportunity not found.</p>
        <Link to="/organizer" className="btn-secondary">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <>
    {(decisionError || deciding) && <div role={decisionError ? 'alert' : 'status'} className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-96 z-[60] rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-800 shadow-lg">
      {decisionError || 'Saving application decisions…'}
      {decisionError && <button type="button" onClick={() => setDecisionError(null)} className="underline ml-2">Dismiss</button>}
    </div>}
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <Link
            to="/organizer"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-3"
          >
            <ArrowLeftIcon size={13} />
            Back to dashboard
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{opportunity.title}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {opportunity.locationType} · Deadline{' '}
                {new Date(opportunity.applicationDeadline).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long',
                })} · {opportunity.positionsAvailable} positions
              </p>
            </div>
            <Link
              to={`/activity/${opportunityId}`}
              className="btn-secondary hidden sm:inline-flex items-center gap-1.5 shrink-0"
            >
              <MessageSquareIcon size={14} />
              Activity hub
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total applications', value: applications.length, color: 'text-slate-900' },
            { label: 'Pending review', value: counts.Pending, color: 'text-amber-700' },
            { label: 'Under review', value: counts['Under Review'], color: 'text-indigo-700' },
            { label: 'Accepted', value: counts.Accepted, color: 'text-green-700' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 border-b border-slate-200">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
              {counts[tab] > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-600'
                }`}>
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
            <CheckSquareIcon size={14} className="text-blue-900 shrink-0" />
            <span className="text-xs font-medium text-blue-900 flex-1">
              {selectedIds.size} application{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => handleBulkStatus('Accepted')}
              disabled={bulking}
              className="text-xs bg-green-700 text-white rounded-lg px-3 py-1.5 hover:bg-green-800 transition-colors disabled:opacity-50"
            >
              Accept all
            </button>
            <button
              onClick={() => handleBulkStatus('Rejected')}
              disabled={bulking}
              className="text-xs text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Decline all
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-400 hover:text-slate-600"
            >
              <XIcon size={14} />
            </button>
          </div>
        )}

        {/* Applications table */}
        {filtered.length === 0 ? (
          <EmptyState
            heading={`No ${activeTab === 'All' ? '' : activeTab.toLowerCase()} applications`}
            description="No applications match this filter."
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 w-8">
                      {selectableFiltered.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-900 accent-blue-900"
                          title="Select all reviewable"
                        />
                      )}
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Applicant</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Submitted</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-slate-600 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(app => {
                    const selectable = app.status === 'Pending' || app.status === 'Under Review';
                    const isSelected = selectedIds.has(app.id);
                    return (
                      <tr key={app.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-blue-50/50' : ''}`}>
                        <td className="px-4 py-3">
                          {selectable && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(app.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-900 accent-blue-900"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 text-sm">{app.applicantName}</p>
                          <p className="text-xs text-slate-500">{app.grade}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">
                          {new Date(app.submittedDate).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip status={app.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewApp(app)}
                              className="text-xs text-blue-900 hover:underline font-medium"
                            >
                              View
                            </button>
                            {app.status === 'Pending' && (
                              <button
                                onClick={() => updateStatus(app.id, 'Under Review')}
                                className="btn-secondary text-xs py-1 px-2"
                              >
                                Review
                              </button>
                            )}
                            {selectable && (
                              <>
                                <button
                                  onClick={() => updateStatus(app.id, 'Accepted')}
                                  className="text-xs text-white bg-green-700 hover:bg-green-800 border border-green-700 rounded-lg px-2 py-1 transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => updateStatus(app.id, 'Rejected')}
                                  className="text-xs text-red-700 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors"
                                >
                                  Decline
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* View application modal */}
      {viewApp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{viewApp.applicantName}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{viewApp.grade} · Submitted {new Date(viewApp.submittedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={viewApp.status} />
                <button
                  onClick={() => setViewApp(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <XIcon size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">Motivation</p>
                <p className="text-sm text-slate-800 leading-relaxed">{viewApp.motivation}</p>
              </div>
              {viewApp.relevantExperience && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1">Relevant experience</p>
                  <p className="text-sm text-slate-800 leading-relaxed">{viewApp.relevantExperience}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">Availability</p>
                <p className="text-sm text-slate-800 leading-relaxed">{viewApp.availability}</p>
              </div>
              {viewApp.applicantEmail && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1">Contact</p>
                  <a
                    href={`mailto:${viewApp.applicantEmail}`}
                    className="text-sm text-blue-900 hover:underline"
                  >
                    {viewApp.applicantEmail}
                  </a>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 flex items-center justify-between gap-2">
              <button onClick={() => setViewApp(null)} className="btn-ghost">
                Close
              </button>
              <div className="flex gap-2">
                {viewApp.status === 'Pending' && (
                  <button
                    onClick={() => updateStatus(viewApp.id, 'Under Review')}
                    className="btn-secondary text-xs"
                  >
                    Mark under review
                  </button>
                )}
                {(viewApp.status === 'Pending' || viewApp.status === 'Under Review') && (
                  <>
                    <button
                      onClick={() => { updateStatus(viewApp.id, 'Rejected'); setViewApp(null); }}
                      className="text-xs text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => { updateStatus(viewApp.id, 'Accepted'); setViewApp(null); }}
                      className="text-xs bg-green-700 text-white border border-green-700 rounded-lg px-3 py-1.5 hover:bg-green-800 transition-colors"
                    >
                      Accept
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
