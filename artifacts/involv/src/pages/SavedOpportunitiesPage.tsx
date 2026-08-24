import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookmarkIcon } from 'lucide-react';
import OpportunityCard from '../components/opportunities/OpportunityCard';
import ApplicationModal from '../components/opportunities/ApplicationModal';
import { EmptyState } from '../components/ui/EmptyState';
import { useOpportunities } from '../hooks/useOpportunities';
import { useApp } from '../context/AppContext';
import type { Opportunity } from '../types';

export default function SavedOpportunitiesPage() {
  const { savedIds } = useApp();
  const { opportunities } = useOpportunities();
  const [applyTarget, setApplyTarget] = useState<Opportunity | null>(null);

  const saved = opportunities.filter(o => savedIds.has(o.id));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <h1 className="text-xl font-bold text-slate-900">Saved Opportunities</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {saved.length === 0
              ? 'No saved opportunities yet.'
              : `${saved.length} saved ${saved.length === 1 ? 'opportunity' : 'opportunities'}`}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {saved.length === 0 ? (
          <EmptyState
            icon={<BookmarkIcon size={20} />}
            heading="Nothing saved yet"
            description="Browse opportunities and tap the bookmark icon to save ones you're interested in."
            action={
              <Link to="/browse" className="btn-primary">
                Browse opportunities
              </Link>
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {saved.map(opp => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                onApply={setApplyTarget}
              />
            ))}
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
