import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  LayoutGridIcon,
} from 'lucide-react';
import { StatusChip } from '../components/ui/StatusChip';
import { CategoryBadge } from '../components/ui/Badge';
import { StatSkeleton, ListRowSkeleton } from '../components/ui/Skeleton';
import OpportunityCard from '../components/opportunities/OpportunityCard';
import ApplicationModal from '../components/opportunities/ApplicationModal';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useOpportunities } from '../hooks/useOpportunities';
import type { Opportunity } from '../types';

const WITHDRAWABLE = new Set(['Pending', 'Under Review']);

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { applications, savedIds, withdrawApplication, loading: appLoading } = useApp();
  const { opportunities, loading: oppsLoading } = useOpportunities();
  const loading = appLoading || oppsLoading;
  const [applyTarget, setApplyTarget] = useState<Opportunity | null>(null);
  const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const handleWithdraw = async (id: string) => {
    setWithdrawing(true);
    try {
      await withdrawApplication(id);
      setConfirmWithdrawId(null);
    } catch {
      // error already logged in context
    } finally {
      setWithdrawing(false);
    }
  };

  const nameParts = user?.name.split(' ') ?? [];
  const firstName = nameParts.find(p => !p.match(/^(Mr|Ms|Mrs|Dr|Prof)\.?$/i)) ?? nameParts[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const saved = opportunities.filter(o => savedIds.has(o.id));
  const recommended = opportunities
    .filter(o => !savedIds.has(o.id) && (
      user?.preferredCategories?.includes(o.category) ||
      o.skillLevel === 'Beginner'
    ))
    .slice(0, 3);

  const upcomingDeadlines = applications.filter(a => {
    const opp = opportunities.find(o => o.id === a.opportunityId);
    if (!opp) return false;
    const days = Math.ceil((new Date(opp.applicationDeadline).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 14;
  });

  const profileFields = [
    !!user?.bio, !!user?.grade,
    (user?.interests?.length ?? 0) > 0,
    (user?.careerGoals?.length ?? 0) > 0,
    (user?.skills?.length ?? 0) > 0,
    (user?.availability?.length ?? 0) > 0,
  ];
  const profileComplete = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Welcome header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {greeting}, {firstName}.
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {applications.length === 0
                  ? 'You have no active applications. Browse available opportunities.'
                  : `You have ${applications.length} application${applications.length > 1 ? 's' : ''} on record.`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link data-testid="link-service-portfolio-desktop" to="/portfolio" className="btn-secondary hidden sm:inline-flex">
                My service portfolio
              </Link>
              <Link to="/browse" className="btn-primary hidden sm:inline-flex">
                Browse opportunities
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          ) : [
            {
              icon: FileTextIcon,
              label: 'Applications',
              value: applications.length,
              color: 'text-blue-900',
              bg: 'bg-blue-50',
            },
            {
              icon: ClockIcon,
              label: 'Pending',
              value: applications.filter(a => a.status === 'Pending').length,
              color: 'text-amber-700',
              bg: 'bg-amber-50',
            },
            {
              icon: CheckCircleIcon,
              label: 'Accepted',
              value: applications.filter(a => a.status === 'Accepted').length,
              color: 'text-green-700',
              bg: 'bg-green-50',
            },
            {
              icon: BookmarkIcon,
              label: 'Saved',
              value: savedIds.size,
              color: 'text-slate-700',
              bg: 'bg-slate-100',
            },
          ].map(stat => (
            <div key={stat.label} className="card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center shrink-0`}>
                <stat.icon size={16} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 leading-none">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Active opportunities */}
        {!loading && applications.filter(a => a.status === 'Accepted').length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Active opportunities</h2>
                <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                  {applications.filter(a => a.status === 'Accepted').length} active
                </span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {applications.filter(a => a.status === 'Accepted').map(app => (
                <Link
                  key={app.id}
                  to={`/activity/${app.opportunityId}`}
                  className="card p-4 flex items-center gap-3 hover:border-blue-200 hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center shrink-0 group-hover:bg-blue-800 transition-colors">
                    <LayoutGridIcon size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-900 transition-colors">
                      {app.opportunityTitle}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Tap to open activity hub</p>
                  </div>
                  <ArrowRightIcon size={14} className="text-slate-300 group-hover:text-blue-900 shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Applications */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">My applications</h2>
            </div>

            <div className="card divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <ListRowSkeleton key={i} />)
              ) : applications.length === 0 ? (
                <EmptyState
                  heading="No applications yet"
                  description="When you apply for an opportunity, it will appear here."
                  action={
                    <Link to="/browse" className="btn-secondary text-xs">
                      Browse opportunities
                    </Link>
                  }
                />
              ) : (
                applications.map(app => (
                  <div key={app.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{app.opportunityTitle}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Submitted {new Date(app.submittedDate).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <StatusChip status={app.status} />
                      {WITHDRAWABLE.has(app.status) && (
                        confirmWithdrawId === app.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Withdraw?</span>
                            <button
                              onClick={() => handleWithdraw(app.id)}
                              disabled={withdrawing}
                              className="text-xs text-red-600 hover:underline font-medium disabled:opacity-50"
                            >
                              {withdrawing ? 'Withdrawing…' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmWithdrawId(null)}
                              className="text-xs text-slate-500 hover:underline"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmWithdrawId(app.id)}
                            className="text-xs text-slate-400 hover:text-red-600 hover:underline transition-colors"
                          >
                            Withdraw
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Upcoming deadlines */}
            {upcomingDeadlines.length > 0 && (
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <CalendarIcon size={13} className="text-amber-600" />
                  Deadlines approaching
                </h3>
                <div className="space-y-2">
                  {upcomingDeadlines.map(app => {
                    const opp = opportunities.find(o => o.id === app.opportunityId)!;
                    const days = Math.ceil((new Date(opp.applicationDeadline).getTime() - Date.now()) / 86400000);
                    return (
                      <div key={app.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 truncate">{app.opportunityTitle}</span>
                        <span className={`font-medium ml-2 shrink-0 ${days <= 3 ? 'text-red-600' : 'text-amber-700'}`}>
                          {days === 0 ? 'Today' : `${days}d`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Profile completeness */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-700">Profile completeness</h3>
                <span className="text-xs font-bold text-blue-900">{profileComplete}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3">
                <div
                  className="bg-blue-900 h-1.5 rounded-full transition-all"
                  style={{ width: `${profileComplete}%` }}
                />
              </div>
              {profileComplete < 100 && (
                <p className="text-xs text-slate-500 mb-3">
                  Complete your profile to get better opportunity recommendations.
                </p>
              )}
              <Link data-testid="link-service-portfolio-mobile" to="/portfolio" className="btn-secondary w-full justify-center text-xs py-1.5 mb-2 sm:hidden">
                My service portfolio
              </Link>
              <Link to="/profile" className="btn-secondary w-full justify-center text-xs py-1.5">
                {profileComplete < 100 ? 'Complete profile' : 'Edit profile'}
              </Link>
            </div>

            {/* Saved preview */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-700">Saved opportunities</h3>
                <Link to="/saved" className="text-xs text-blue-900 hover:underline flex items-center gap-1">
                  View all <ArrowRightIcon size={11} />
                </Link>
              </div>
              {saved.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Save opportunities from the browse page to review them later.
                </p>
              ) : (
                <div className="space-y-2">
                  {saved.slice(0, 3).map(opp => (
                    <Link
                      key={opp.id}
                      to={`/opportunities/${opp.id}`}
                      className="flex items-start gap-2 group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 group-hover:text-blue-900 leading-snug truncate">
                          {opp.title}
                        </p>
                        <CategoryBadge category={opp.category} size="sm" />
                      </div>
                    </Link>
                  ))}
                  {saved.length > 3 && (
                    <Link to="/saved" className="text-xs text-blue-900 hover:underline">
                      +{saved.length - 3} more saved
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recommended */}
        {recommended.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Recommended for you</h2>
                <p className="text-xs text-slate-500 mt-0.5">Based on your interests and category preferences.</p>
              </div>
              <Link to="/browse" className="text-xs text-blue-900 hover:underline flex items-center gap-1">
                See all <ArrowRightIcon size={11} />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommended.map(opp => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onApply={setApplyTarget}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {applyTarget && (
        <ApplicationModal
          opportunity={applyTarget}
          onClose={() => setApplyTarget(null)}
        />
      )}
    </div>
  );
}
