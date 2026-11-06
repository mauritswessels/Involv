import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ReportsPanel from '../components/admin/ReportsPanel';
import PrivacyRequestsPanel from '../components/admin/PrivacyRequestsPanel';
import {
  DownloadIcon,
  FileTextIcon,
  ShieldIcon,
  StarIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react';

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
  };
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
import { CategoryBadge } from '../components/ui/Badge';
import { StatusChip } from '../components/ui/StatusChip';
import type { User, Opportunity, Application, UserRole, ApplicationStatus } from '../types';
import { logSafeError } from '../utils/safeConsole';
import {
  getAllProfiles,
  getAllOpportunitiesAdmin,
  getAllApplicationsAdmin,
  setUserRole,
  deleteUserProfile,
  deleteOpportunity,
  setOpportunityFeatured,
  adminSetOpportunityStatus,
} from '../services/adminService';
import { useAuth } from '../context/AuthContext';
import { isSchoolEmail } from '../lib/schoolAccess';

type Tab = 'users' | 'opportunities' | 'applications' | 'reports' | 'privacy';
const TAB_ORDER: Tab[] = ['users', 'opportunities', 'applications', 'reports', 'privacy'];

const ROLES: UserRole[] = ['student', 'teacher', 'organizer', 'admin'];
const STATUSES = ['active', 'draft', 'closed', 'archived'] as const;
const APP_STATUSES: ApplicationStatus[] = ['Pending', 'Under Review', 'Accepted', 'Rejected'];

const roleColors: Record<UserRole, string> = {
  student:   'bg-blue-50 text-blue-700',
  teacher:   'bg-purple-50 text-purple-700',
  organizer: 'bg-amber-50 text-amber-700',
  admin:     'bg-red-50 text-red-700',
};

const statusColors: Record<string, string> = {
  active:   'bg-green-50 text-green-700',
  draft:    'bg-slate-100 text-slate-600',
  closed:   'bg-amber-50 text-amber-700',
  archived: 'bg-red-50 text-red-600',
};

export default function AdminPage() {
  const { user: me } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as Tab | null;
  const [tab, setTabState] = useState<Tab>(requestedTab && TAB_ORDER.includes(requestedTab) ? requestedTab : 'users');
  const setTab = (next: Tab) => { setTabState(next); setSearchParams(next === 'users' ? {} : { tab: next }, { replace: true }); };
  useEffect(() => {
    if (requestedTab && TAB_ORDER.includes(requestedTab)) setTabState(requestedTab);
  }, [requestedTab]);
  const [openReports, setOpenReports] = useState<number | null>(null);
  const [openRequests, setOpenRequests] = useState<number | null>(null);

  // Data
  const [users, setUsers]               = useState<User[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications]  = useState<Application[]>([]);
  const [loading, setLoading]            = useState(true);
  const [error, setError]                = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [roleNotice, setRoleNotice] = useState<string | null>(null);

  // Search / filter
  const [userSearch,   setUserSearch]   = useState('');
  const [oppSearch,    setOppSearch]    = useState('');
  const [appSearch,    setAppSearch]    = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState<ApplicationStatus | ''>('');

  // Inline delete confirm
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);
  const [confirmDeleteOpp,  setConfirmDeleteOpp]  = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load all data on mount
  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getAllProfiles(),
      getAllOpportunitiesAdmin(),
      getAllApplicationsAdmin(),
    ])
      .then(([profiles, opps, apps]) => {
        setUsers(profiles);
        setOpportunities(opps);
        setApplications(apps);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Per-user stats ──────────────────────────────────────────
  const userAppCounts = useMemo(() => {
    const map: Record<string, number> = {};
    applications.forEach(a => { map[a.applicantId] = (map[a.applicantId] ?? 0) + 1; });
    return map;
  }, [applications]);

  const userOppCounts = useMemo(() => {
    const map: Record<string, number> = {};
    opportunities.forEach(o => {
      if (o.organizerId) map[o.organizerId] = (map[o.organizerId] ?? 0) + 1;
    });
    return map;
  }, [opportunities]);

  // ── User actions ────────────────────────────────────────────
  const handleRoleChange = async (uid: string, role: UserRole) => {
    const target = users.find(u => u.id === uid);
    if (!target || uid === me?.id || !isSchoolEmail(target.email)) return;
    if (role !== 'student' && !window.confirm(`Approve ${target.name} as ${role}? This grants additional platform permissions.`)) return;
    setChangingRole(uid);
    setError(null);
    setRoleNotice(null);
    try {
      const updated = await setUserRole(uid, role);
      setUsers(prev => prev.map(u => u.id === uid ? updated : u));
      setRoleNotice(`${updated.name} now has ${updated.role} access.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role approval failed. No change was saved.');
    } finally {
      setChangingRole(null);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    setDeleting(true);
    try {
      await deleteUserProfile(uid);
      setUsers(prev => prev.filter(u => u.id !== uid));
      setConfirmDeleteUser(null);
    } catch (err) {
      logSafeError('[Admin] delete user failed', err);
    } finally {
      setDeleting(false);
    }
  };

  // ── Opportunity actions ─────────────────────────────────────
  const handleStatusChange = async (id: string, status: typeof STATUSES[number]) => {
    setOpportunities(prev => prev.map(o => (o.id === id ? { ...o, status } : o)));
    try { await adminSetOpportunityStatus(id, status); }
    catch (err) { logSafeError('[Admin] set opportunity status failed', err); }
  };

  const handleFeatureToggle = async (id: string, featured: boolean) => {
    setOpportunities(prev => prev.map(o => (o.id === id ? { ...o, featured } : o)));
    try { await setOpportunityFeatured(id, featured); }
    catch (err) { logSafeError('[Admin] feature opportunity failed', err); }
  };

  const handleDeleteOpp = async (id: string) => {
    setDeleting(true);
    try {
      await deleteOpportunity(id);
      setOpportunities(prev => prev.filter(o => o.id !== id));
      setApplications(prev => prev.filter(a => a.opportunityId !== id));
      setConfirmDeleteOpp(null);
    } catch (err) {
      logSafeError('[Admin] delete opportunity failed', err);
    } finally {
      setDeleting(false);
    }
  };

  // ── Filtered lists ──────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const filteredOpps = opportunities.filter(o => {
    const q = oppSearch.toLowerCase();
    return !q || o.title.toLowerCase().includes(q) || o.organizerName.toLowerCase().includes(q);
  });

  const filteredApps = applications.filter(a => {
    const q = appSearch.toLowerCase();
    const matchesSearch = !q ||
      a.applicantName.toLowerCase().includes(q) ||
      a.opportunityTitle.toLowerCase().includes(q) ||
      (a.applicantEmail ?? '').toLowerCase().includes(q);
    const matchesStatus = !appStatusFilter || a.status === appStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Stats ───────────────────────────────────────────────────
  const stats = [
    { label: 'Total users',     value: users.length,                                                  icon: UsersIcon,    color: 'text-blue-900 bg-blue-50'   },
    { label: 'Organizers',      value: users.filter(u => u.role === 'organizer' || u.role === 'teacher').length, icon: UsersIcon, color: 'text-amber-700 bg-amber-50' },
    { label: 'Opportunities',   value: opportunities.length,                                          icon: FileTextIcon, color: 'text-indigo-700 bg-indigo-50' },
    { label: 'Applications',    value: applications.length,                                           icon: FileTextIcon, color: 'text-green-700 bg-green-50'   },
  ];

  const tabLabels: Record<Tab, string> = {
    users:         `Users (${users.length})`,
    opportunities: `Opportunities (${opportunities.length})`,
    applications:  `Applications (${applications.length})`,
    reports:       openReports ? `Reports (${openReports})` : 'Reports',
    privacy:       openRequests ? `Privacy requests (${openRequests})` : 'Privacy requests',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldIcon size={16} className="text-red-600" />
            <h1 className="text-xl font-bold text-slate-900">Admin panel</h1>
          </div>
          <p className="text-sm text-slate-500">Only verified @iszl.ch members can use Involv. New members start as students; approve teacher and organiser roles in the Users tab.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.color} flex items-center justify-center shrink-0`}>
                <s.icon size={16} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 leading-none">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
        )}
        {roleNotice && <div role="status" className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">{roleNotice}</div>}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
          {TAB_ORDER.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>

        {/* ── Users tab ───────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <input
                type="search"
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="input-field flex-1 max-w-sm text-sm"
              />
              <button
                onClick={() => downloadCSV('users.csv', filteredUsers.map(u => ({
                  name: u.name, email: u.email, role: u.role, grade: u.grade ?? '',
                  joined: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '',
                  applications: userAppCounts[u.id] ?? 0,
                  listings: userOppCounts[u.id] ?? 0,
                })))}
                className="btn-secondary text-xs shrink-0 flex items-center gap-1.5"
              >
                <DownloadIcon size={12} /> Export CSV
              </button>
            </div>
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading users…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">User</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Email</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Role</th>
                      <th className="text-center text-xs font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Apps</th>
                      <th className="text-center text-xs font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Listings</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">Joined</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-blue-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                              {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className="font-medium text-slate-900 text-xs">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-slate-500">{u.email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                            disabled={changingRole !== null || u.id === me?.id || !isSchoolEmail(u.email)}
                            aria-label={`Approved role for ${u.name}`}
                            title={u.id === me?.id ? 'Ask another administrator to change your role.' : !isSchoolEmail(u.email) ? 'Only ISZL accounts are eligible for platform access.' : 'Administrator-approved role'}
                            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer disabled:opacity-50 focus:ring-2 focus:ring-blue-500 ${roleColors[u.role]}`}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span className="text-xs font-semibold text-slate-700">{userAppCounts[u.id] ?? 0}</span>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span className="text-xs font-semibold text-slate-700">{userOppCounts[u.id] ?? 0}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-slate-500">
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {/* Can't delete yourself */}
                          {u.id !== me?.id && (
                            confirmDeleteUser === u.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs text-slate-500">Delete?</span>
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  disabled={deleting}
                                  className="text-xs text-red-600 hover:underline font-medium disabled:opacity-50"
                                >
                                  {deleting ? '…' : 'Yes'}
                                </button>
                                <button onClick={() => setConfirmDeleteUser(null)} className="text-xs text-slate-400 hover:underline">No</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteUser(u.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                                title="Delete user"
                              >
                                <Trash2Icon size={14} />
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-500">No users match your search.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Opportunities tab ────────────────────────────────── */}
        {tab === 'opportunities' && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <input
                type="search"
                placeholder="Search by title or organizer…"
                value={oppSearch}
                onChange={e => setOppSearch(e.target.value)}
                className="input-field flex-1 max-w-sm text-sm"
              />
              <button
                onClick={() => downloadCSV('opportunities.csv', filteredOpps.map(o => ({
                  title: o.title, organizer: o.organizerName, category: o.category,
                  status: o.status ?? 'active', applicants: o.applicantsCount,
                  positions: o.positionsAvailable, deadline: o.applicationDeadline,
                  featured: o.featured ? 'yes' : 'no',
                })))}
                className="btn-secondary text-xs shrink-0 flex items-center gap-1.5"
              >
                <DownloadIcon size={12} /> Export CSV
              </button>
            </div>
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading opportunities…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Title</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Category</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Status</th>
                      <th className="text-center text-xs font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Applicants</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">Deadline</th>
                      <th className="text-center text-xs font-semibold text-slate-600 px-4 py-3">⭐</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOpps.map(opp => (
                      <tr key={opp.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 text-xs leading-snug">{opp.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{opp.organizerName}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <CategoryBadge category={opp.category} size="sm" />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={opp.status ?? 'active'}
                            onChange={e => handleStatusChange(opp.id, e.target.value as typeof STATUSES[number])}
                            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${statusColors[opp.status ?? 'active']}`}
                          >
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span className="text-xs font-semibold text-slate-900">{opp.applicantsCount}</span>
                          <span className="text-xs text-slate-400">/{opp.positionsAvailable}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-slate-600">
                            {new Date(opp.applicationDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleFeatureToggle(opp.id, !opp.featured)}
                            title={opp.featured ? 'Remove featured' : 'Mark featured'}
                            className={`transition-colors ${opp.featured ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-amber-400'}`}
                          >
                            <StarIcon size={15} fill={opp.featured ? 'currentColor' : 'none'} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {confirmDeleteOpp === opp.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-slate-500">Delete?</span>
                              <button
                                onClick={() => handleDeleteOpp(opp.id)}
                                disabled={deleting}
                                className="text-xs text-red-600 hover:underline font-medium disabled:opacity-50"
                              >
                                {deleting ? '…' : 'Yes'}
                              </button>
                              <button onClick={() => setConfirmDeleteOpp(null)} className="text-xs text-slate-400 hover:underline">No</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-3">
                              <Link
                                to={`/edit/${opp.id}`}
                                className="text-xs text-blue-800 hover:underline font-medium"
                              >
                                Edit
                              </Link>
                              <button
                                onClick={() => setConfirmDeleteOpp(opp.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                                title="Delete opportunity"
                              >
                                <Trash2Icon size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredOpps.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-500">No opportunities match your search.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Applications tab ─────────────────────────────────── */}
        {tab === 'applications' && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
              <input
                type="search"
                placeholder="Search by applicant, opportunity, or email…"
                value={appSearch}
                onChange={e => setAppSearch(e.target.value)}
                className="input-field flex-1 min-w-[200px] text-sm"
              />
              <select
                value={appStatusFilter}
                onChange={e => setAppStatusFilter(e.target.value as ApplicationStatus | '')}
                className="input-field text-sm w-auto"
              >
                <option value="">All statuses</option>
                {APP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                onClick={() => downloadCSV('applications.csv', filteredApps.map(a => ({
                  applicant: a.applicantName, email: a.applicantEmail ?? '',
                  grade: a.grade, opportunity: a.opportunityTitle,
                  status: a.status, submitted: a.submittedDate,
                })))}
                className="btn-secondary text-xs shrink-0 flex items-center gap-1.5"
              >
                <DownloadIcon size={12} /> Export CSV
              </button>
            </div>
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading applications…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Applicant</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Opportunity</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Grade</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredApps.map(app => (
                      <tr key={app.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-slate-900">{app.applicantName}</p>
                          {app.applicantEmail && (
                            <p className="text-xs text-slate-400 mt-0.5">{app.applicantEmail}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-700 leading-snug">{app.opportunityTitle}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-slate-500">{app.grade || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip status={app.status} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-slate-500">
                            {new Date(app.submittedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredApps.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">No applications match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'reports' && <ReportsPanel onCountChange={setOpenReports} />}
        {tab === 'privacy' && <PrivacyRequestsPanel onCountChange={setOpenRequests} />}

      </div>
    </div>
  );
}
