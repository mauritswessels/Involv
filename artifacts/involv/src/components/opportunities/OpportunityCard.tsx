import { Link } from 'react-router-dom';
import {
  BookmarkIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  UserIcon,
} from 'lucide-react';
import { CategoryBadge, Pill } from '../ui/Badge';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { Opportunity } from '../../types';
import { applicationDeadlineDays } from '../../utils/applicationDeadline';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onApply?: (opportunity: Opportunity) => void;
  compact?: boolean;
}

export default function OpportunityCard({ opportunity, onApply, compact = false }: OpportunityCardProps) {
  const { isSaved, toggleSave, isApplied, isSaving } = useApp();
  const { isAuthenticated } = useAuth();
  const saved = isSaved(opportunity.id);
  const applied = isApplied(opportunity.id);

  const deadline = new Date(opportunity.applicationDeadline);
  const daysLeft = applicationDeadlineDays(opportunity.applicationDeadline);
  const deadlineSoon = daysLeft >= 0 && daysLeft <= 7;

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-card transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <CategoryBadge category={opportunity.category} />
          <h3 className="mt-2 text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
            {opportunity.title}
          </h3>
        </div>
        {isAuthenticated && (
          <button
            onClick={() => toggleSave(opportunity.id)}
            disabled={isSaving(opportunity.id)}
            aria-busy={isSaving(opportunity.id)}
            aria-label={saved ? 'Remove from saved' : 'Save opportunity'}
            className={`shrink-0 mt-0.5 p-1.5 rounded-lg transition-colors ${
              saved
                ? 'text-blue-900 bg-blue-50 hover:bg-blue-100'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookmarkIcon size={15} fill={saved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
        {opportunity.shortDescription}
      </p>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <MapPinIcon size={11} className="shrink-0" />
          {opportunity.locationType}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <ClockIcon size={11} className="shrink-0" />
          {opportunity.timeCommitment}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <UserIcon size={11} className="shrink-0" />
          {opportunity.organizerName.split(' ').slice(-1)[0]}
        </span>
      </div>

      {/* Pills */}
      <div className="flex flex-wrap gap-1.5">
        <Pill label={opportunity.durationType} />
        <Pill label={opportunity.skillLevel} />
        <Pill label={`${opportunity.serviceType} service`} />
        {opportunity.servicePrograms.map(program => <Pill key={program} label={program} />)}
      </div>

      {!compact && (
        <>
          {/* Deadline */}
          <div
            className={`flex items-center gap-1.5 text-xs ${
              deadlineSoon ? 'text-amber-700' : 'text-slate-500'
            }`}
          >
            <CalendarIcon size={11} className="shrink-0" />
            <span>
              {daysLeft < 0
                ? 'Deadline passed'
                : daysLeft === 0
                ? 'Deadline today'
                : `Apply by ${deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${daysLeft}d left`}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-auto">
            <Link
              to={`/opportunities/${opportunity.id}`}
              className="btn-secondary flex-1 justify-center py-1.5 text-xs"
            >
              View details
            </Link>
            {applied ? (
              <span className="flex-1 text-center text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg py-1.5">
                Applied
              </span>
            ) : (
              <button
                onClick={() => onApply?.(opportunity)}
                disabled={!isAuthenticated || daysLeft < 0}
                className="btn-primary flex-1 justify-center py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
