import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  GlobeIcon,
  MapPinIcon,
  UsersIcon,
} from 'lucide-react';
import { CategoryBadge, Pill, TagBadge } from '../components/ui/Badge';
import ApplicationModal from '../components/opportunities/ApplicationModal';
import OpportunityCard from '../components/opportunities/OpportunityCard';
import { useOpportunities } from '../hooks/useOpportunities';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { applicationDeadlineDays } from '../utils/applicationDeadline';

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSaved, toggleSave, isApplied, isSaving } = useApp();
  const { isAuthenticated } = useAuth();
  const { opportunities, loading } = useOpportunities();
  const [applyOpen, setApplyOpen] = useState(false);

  const opportunity = opportunities.find(o => o.id === id);

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
        <p className="text-sm text-slate-600 mb-4">This opportunity could not be found.</p>
        <Link to="/browse" className="btn-secondary">
          Back to Browse
        </Link>
      </div>
    );
  }

  const saved = isSaved(opportunity.id);
  const applied = isApplied(opportunity.id);
  const deadline = new Date(opportunity.applicationDeadline);
  const daysLeft = applicationDeadlineDays(opportunity.applicationDeadline);
  const deadlinePassed = daysLeft < 0;

  const similar = opportunities
    .filter(o => o.id !== opportunity.id && o.category === opportunity.category)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeftIcon size={13} />
            Back to Browse
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Header */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <CategoryBadge category={opportunity.category} size="md" />
                  <h1 className="mt-3 text-xl font-bold text-slate-900 leading-snug">
                    {opportunity.title}
                  </h1>
                </div>
                {isAuthenticated && (
                  <button
                    onClick={() => toggleSave(opportunity.id)}
                    disabled={isSaving(opportunity.id)}
                    aria-busy={isSaving(opportunity.id)}
                    aria-label={saved ? 'Remove from saved' : 'Save'}
                    className={`shrink-0 p-2 rounded-lg border transition-colors ${
                      saved
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <BookmarkIcon size={16} fill={saved ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>

              {/* Quick meta row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { icon: MapPinIcon, label: 'Location', value: opportunity.locationType },
                  { icon: ClockIcon, label: 'Time', value: opportunity.timeCommitment },
                  { icon: UsersIcon, label: 'Total places', value: `${opportunity.positionsAvailable}` },
                  {
                    icon: CalendarIcon,
                    label: 'Deadline',
                    value: deadlinePassed
                      ? 'Passed'
                      : `${daysLeft}d left`,
                  },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <item.icon size={12} className="text-slate-400" />
                      <span className="text-xs text-slate-500">{item.label}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Pill label={opportunity.durationType} />
                <Pill label={opportunity.skillLevel} />
                <Pill label={opportunity.impactType + ' impact'} />
              </div>
            </div>

            {/* Description */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">About this opportunity</h2>
              <div className="text-sm text-slate-700 leading-relaxed space-y-3 whitespace-pre-line">
                {opportunity.fullDescription}
              </div>
            </div>

            {/* Impact */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Impact</h2>
              <p className="text-sm text-slate-700 leading-relaxed">{opportunity.impactDescription}</p>
            </div>

            {/* Skills gained */}
            {opportunity.skillsGained.length > 0 && (
              <div className="card p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Skills you'll develop</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                  {opportunity.skillsGained.map(skill => (
                    <div key={skill} className="flex items-center gap-2">
                      <CheckIcon size={13} className="text-green-700 shrink-0" />
                      <span className="text-sm text-slate-700">{skill}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Requirements */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Requirements and details</h2>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Dates</p>
                  <p className="text-slate-800">{opportunity.dates}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Location</p>
                  <p className="text-slate-800">{opportunity.locationText}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Start date</p>
                  <p className="text-slate-800">
                    {new Date(opportunity.startDate).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Minimum year group</p>
                  <p className="text-slate-800">{opportunity.minGradeOrAge || 'Open to all'}</p>
                </div>
                {opportunity.skillsRequired.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-slate-500 mb-2">Skills expected</p>
                    <div className="flex flex-wrap gap-1.5">
                      {opportunity.skillsRequired.map(s => (
                        <TagBadge key={s} label={s} />
                      ))}
                    </div>
                  </div>
                )}
                {opportunity.languageRequirements.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Language</p>
                    <p className="text-slate-800">{opportunity.languageRequirements.join(', ')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {opportunity.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {opportunity.tags.map(tag => (
                  <TagBadge key={tag} label={tag} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar action card */}
          <aside className="lg:w-72 shrink-0 space-y-4">
            <div className="card p-5 space-y-4 lg:sticky lg:top-20">
              <div>
                <p className="text-xs text-slate-500 mb-1">Application deadline</p>
                <p className={`text-sm font-semibold ${deadlinePassed ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-700' : 'text-slate-900'}`}>
                  {deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {!deadlinePassed && (
                    <span className="font-normal text-xs ml-2 opacity-80">
                      ({daysLeft === 0 ? 'today' : `${daysLeft} days`})
                    </span>
                  )}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500 mb-1">Posted by</p>
                <p className="text-sm font-medium text-slate-900">{opportunity.organizerName}</p>
                <p className="text-xs text-slate-500">{opportunity.organizerRole}</p>
                <p className="text-xs text-slate-500 mt-2">Apply through Involv. Accepted participants can use the activity group.</p>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Applications on record</span>
                  <span className="font-semibold text-slate-900">{opportunity.applicantsCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total places</span>
                  <span className="font-semibold text-slate-900">{opportunity.positionsAvailable}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                {applied ? (
                  <div className="w-full text-center text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg py-2.5">
                    Application submitted
                  </div>
                ) : deadlinePassed ? (
                  <div className="w-full text-center text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg py-2.5">
                    Deadline has passed
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!isAuthenticated) navigate('/login');
                      else setApplyOpen(true);
                    }}
                    className="btn-primary w-full justify-center py-2.5"
                  >
                    {isAuthenticated ? 'Apply now' : 'Sign in to apply'}
                  </button>
                )}
                {isAuthenticated && (
                  <button
                    onClick={() => toggleSave(opportunity.id)}
                    disabled={isSaving(opportunity.id)}
                    aria-busy={isSaving(opportunity.id)}
                    className="btn-secondary w-full justify-center py-2"
                  >
                    <BookmarkIcon size={13} fill={saved ? 'currentColor' : 'none'} />
                    {saved ? 'Saved' : 'Save for later'}
                  </button>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <GlobeIcon size={12} />
                  <span>{opportunity.locationType} · {opportunity.locationText.split(',')[0]}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Similar opportunities */}
        {similar.length > 0 && (
          <div className="mt-10">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              More in {opportunity.category}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {similar.map(opp => (
                <OpportunityCard key={opp.id} opportunity={opp} onApply={() => {}} />
              ))}
            </div>
          </div>
        )}
      </div>

      {applyOpen && (
        <ApplicationModal
          opportunity={opportunity}
          onClose={() => setApplyOpen(false)}
        />
      )}
    </div>
  );
}
