import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  CalendarIcon,
  CopyIcon,
  FileTextIcon,
  PlusIcon,
  UsersIcon,
} from 'lucide-react';
import { StatusChip } from '../components/ui/StatusChip';
import { CategoryBadge } from '../components/ui/Badge';
import { StatSkeleton, ListRowSkeleton, TableRowSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useOrganizerData } from '../hooks/useOrganizerData';

export default function OrganizerDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { opportunities, applications, loading, live } = useOrganizerData();

  const nameParts = user?.name.split(' ') ?? [];
  const firstName = nameParts.find(p => !p.match(/^(Mr|Ms|Mrs|Dr|Prof)\.?$/i)) ?? nameParts[0] ?? 'there';

  const totalApplicants = applications.length;
  const pending = applications.filter(a => a.status === 'Pending').length;
  const accepted = applications.filter(a => a.status === 'Accepted').length;

  const nearDeadline = opportunities.filter(opp => {
    const days = Math.ceil((new Date(opp.applicationDeadline).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 14;
  });

  // Show the 5 most recent applications across all opportunities
  const recentApplications = [...applications]
    .sort((a, b) => new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime())
    .slice(0, 5);

  // The first opportunity with applications (for the "Manage all" link)
  const firstOppId = opportunities[0]?.id ?? '';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Welcome back, {firstName}.
              </h1>
              <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                {loading
                  ? 'Loading your data…'
                  : `${pending} new application${pending !== 1 ? 's' : ''} waiting for review.`}
                {!loading && live && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
                  </span>
                )}
              </p>
            </div>
            <Link to="/create" className="btn-primary hidden sm:inline-flex shrink-0">
              <PlusIcon size={14} />
              Post opportunity
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          ) : [
            { label: 'Listings posted', value: opportunities.length, icon: FileTextIcon, color: 'text-blue-900 bg-blue-50' },
            { label: 'Total applicants', value: totalApplicants, icon: UsersIcon, color: 'text-indigo-700 bg-indigo-50' },
            { label: 'Pending review', value: pending, icon: CalendarIcon, color: 'text-amber-700 bg-amber-50' },
            { label: 'Accepted', value: accepted, icon: UsersIcon, color: 'text-green-700 bg-green-50' },
          ].map(stat => (
            <div key={stat.label} className="card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center shrink-0`}>
                <stat.icon size={16} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 leading-none">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent applications */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Recent applications</h2>
              {firstOppId && (
                <Link
                  to={`/applications/${firstOppId}`}
                  className="text-xs text-blue-900 hover:underline flex items-center gap-1"
                >
                  Manage all <ArrowRightIcon size={11} />
                </Link>
              )}
            </div>
            <div className="card divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <ListRowSkeleton key={i} />)
              ) : recentApplications.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No applications yet. Post an opportunity to start receiving them.
                </div>
              ) : (
                recentApplications.map(app => (
                  <div key={app.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-slate-900">{app.applicantName}</p>
                        <span className="text-xs text-slate-400">{app.grade}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{app.opportunityTitle}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(app.submittedDate).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short',
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusChip status={app.status} />
                      <Link
                        to={`/applications/${app.opportunityId}`}
                        className="text-xs text-blue-900 hover:underline"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Quick action */}
            <div className="card p-4 bg-blue-900 border-blue-800">
              <p className="text-sm font-semibold text-white mb-1">Post a new opportunity</p>
              <p className="text-xs text-blue-200 mb-4 leading-relaxed">
                List a new service-learning opportunity and start receiving applications.
              </p>
              <Link to="/create" className="inline-flex items-center gap-1.5 bg-white text-blue-900 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                <PlusIcon size={13} />
                Post opportunity
              </Link>
            </div>

            {/* Upcoming deadlines */}
            {nearDeadline.length > 0 && (
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <CalendarIcon size={13} className="text-amber-600" />
                  Deadlines this fortnight
                </h3>
                <div className="space-y-2">
                  {nearDeadline.map(opp => {
                    const days = Math.ceil(
                      (new Date(opp.applicationDeadline).getTime() - Date.now()) / 86400000,
                    );
                    return (
                      <div key={opp.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 truncate">{opp.title}</span>
                        <span className={`ml-2 font-medium shrink-0 ${days <= 3 ? 'text-red-600' : 'text-amber-700'}`}>
                          {days === 0 ? 'Today' : `${days}d`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* My listings table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">My listings</h2>
          </div>
          <div className="card overflow-hidden">
            {loading ? (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)}
                </tbody>
              </table>
            ) : opportunities.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No listings yet.{' '}
                <Link to="/create" className="text-blue-900 hover:underline">Post your first opportunity.</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Opportunity</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Category</th>
                      <th className="text-center text-xs font-semibold text-slate-600 px-4 py-3">Applicants</th>
                      <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Deadline</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {opportunities.map(opp => {
                      const days = Math.ceil(
                        (new Date(opp.applicationDeadline).getTime() - Date.now()) / 86400000,
                      );
                      const oppApplications = applications.filter(a => a.opportunityId === opp.id);
                      return (
                        <tr key={opp.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900 text-xs leading-snug">{opp.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{opp.locationType}</p>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <CategoryBadge category={opp.category} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-semibold text-slate-900">{oppApplications.length}</span>
                            <span className="text-xs text-slate-400">/{opp.positionsAvailable}</span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`text-xs font-medium ${days <= 7 ? 'text-amber-700' : 'text-slate-600'}`}>
                              {days < 0
                                ? 'Passed'
                                : new Date(opp.applicationDeadline).toLocaleDateString('en-GB', {
                                    day: 'numeric', month: 'short',
                                  })}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => navigate('/create', { state: { duplicate: opp } })}
                                title="Duplicate listing"
                                className="text-slate-400 hover:text-slate-700 transition-colors"
                              >
                                <CopyIcon size={13} />
                              </button>
                              <Link
                                to={`/edit/${opp.id}`}
                                className="text-xs text-slate-600 hover:underline font-medium"
                              >
                                Edit
                              </Link>
                              <Link
                                to={`/applications/${opp.id}`}
                                className="text-xs text-blue-900 hover:underline font-medium"
                              >
                                Manage
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
