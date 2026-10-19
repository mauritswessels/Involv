import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterIcon, SearchIcon, StarIcon, XIcon } from 'lucide-react';
import OpportunityCard from '../components/opportunities/OpportunityCard';
import ApplicationModal from '../components/opportunities/ApplicationModal';
import { EmptyState } from '../components/ui/EmptyState';
import { CardSkeleton } from '../components/ui/Skeleton';
import { useOpportunities } from '../hooks/useOpportunities';
import type { FilterState, Category, LocationType, DurationType, SkillLevel, ServiceType, ServiceProgram, Opportunity } from '../types';
import { matchesOpportunityTaxonomy } from '../utils/opportunityTaxonomy';

const CATEGORIES: Category[] = [
  'Community & Social Impact',
  'Health & Wellbeing',
  'Sustainability & Environment',
  'Global & Humanitarian',
  'Arts, Culture & Media',
  'School-Based Service',
  'Business, Leadership & Management',
  'Technology & Innovation',
  'Education & Mentorship',
];

const LOCATION_TYPES: LocationType[] = ['On-campus', 'Off-campus', 'Remote'];
const DURATION_TYPES: DurationType[] = ['One-time', 'Ongoing', 'Fixed period'];
const SKILL_LEVELS: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
const SERVICE_TYPES: ServiceType[] = ['Direct', 'Indirect', 'Advocacy', 'Research'];
const SERVICE_PROGRAMS: { value: ServiceProgram; label: string }[] = [
  { value: 'IB DP', label: 'IB Diploma Programme (IB DP)' },
  { value: 'HSP', label: 'High School Program (HSP)' },
];

const defaultFilters: FilterState = {
  search: '',
  categories: [],
  locationType: '',
  durationType: '',
  skillLevel: '',
  serviceType: '',
  servicePrograms: [],
  sortBy: 'newest',
};

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2.5">{label}</p>
      {children}
    </div>
  );
}

export default function BrowsePage() {
  const { opportunities, loading, error, retry } = useOpportunities();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterState>({
    ...defaultFilters,
    search: searchParams.get('q') ?? '',
    categories: searchParams.get('category')
      ? [searchParams.get('category') as Category]
      : [],
  });
  const [applyTarget, setApplyTarget] = useState<Opportunity | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q');
    const cat = searchParams.get('category');
    setFilters(f => ({
      ...f,
      search: q ?? f.search,
      categories: cat ? [cat as Category] : f.categories,
    }));
  }, [searchParams]);

  const filtered = useMemo(() => {
    let list = [...opportunities];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        o =>
          o.title.toLowerCase().includes(q) ||
          o.shortDescription.toLowerCase().includes(q) ||
          o.tags.some(t => t.toLowerCase().includes(q)) ||
          o.serviceType.toLowerCase().includes(q) ||
          o.servicePrograms.some(program => program.toLowerCase().includes(q)) ||
          o.category.toLowerCase().includes(q),
      );
    }

    if (filters.categories.length > 0) {
      list = list.filter(o => filters.categories.includes(o.category));
    }
    if (filters.locationType) {
      list = list.filter(o => o.locationType === filters.locationType);
    }
    if (filters.durationType) {
      list = list.filter(o => o.durationType === filters.durationType);
    }
    if (filters.skillLevel) {
      list = list.filter(o => o.skillLevel === filters.skillLevel);
    }
    list = list.filter(o =>
      matchesOpportunityTaxonomy(o, filters.serviceType, filters.servicePrograms),
    );
    switch (filters.sortBy) {
      case 'deadline':
        list.sort((a, b) => new Date(a.applicationDeadline).getTime() - new Date(b.applicationDeadline).getTime());
        break;
      case 'popular':
        list.sort((a, b) => b.applicantsCount - a.applicantsCount);
        break;
      case 'newest':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return list;
  }, [filters]);

  const activeFilterCount =
    filters.categories.length +
    (filters.locationType ? 1 : 0) +
    (filters.durationType ? 1 : 0) +
    (filters.skillLevel ? 1 : 0) +
    (filters.serviceType ? 1 : 0) +
    filters.servicePrograms.length;

  const clearFilters = () =>
    setFilters(f => ({ ...defaultFilters, search: f.search }));

  const toggleCategory = (cat: Category) =>
    setFilters(f => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter(c => c !== cat)
        : [...f.categories, cat],
    }));

  const toggleServiceProgram = (program: ServiceProgram) =>
    setFilters(f => ({
      ...f,
      servicePrograms: f.servicePrograms.includes(program)
        ? f.servicePrograms.filter(value => value !== program)
        : [...f.servicePrograms, program],
    }));

  const FilterPanel = () => (
    <div className="space-y-0">
      <FilterSection label="Category">
        <div className="space-y-1.5">
          {CATEGORIES.map(cat => (
            <label key={cat} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.categories.includes(cat)}
                onChange={() => toggleCategory(cat)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-900 focus:ring-blue-900/20 accent-blue-900"
              />
              <span className="text-xs text-slate-700 group-hover:text-slate-900">{cat}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Location">
        <div className="space-y-1.5">
          {LOCATION_TYPES.map(t => (
            <label key={t} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="location"
                checked={filters.locationType === t}
                onChange={() =>
                  setFilters(f => ({
                    ...f,
                    locationType: f.locationType === t ? '' : t,
                  }))
                }
                className="w-3.5 h-3.5 border-slate-300 text-blue-900 accent-blue-900"
              />
              <span className="text-xs text-slate-700 group-hover:text-slate-900">{t}</span>
            </label>
          ))}
          {filters.locationType && (
            <button
              onClick={() => setFilters(f => ({ ...f, locationType: '' }))}
              className="text-xs text-slate-400 hover:text-slate-600 mt-0.5"
            >
              Clear
            </button>
          )}
        </div>
      </FilterSection>

      <FilterSection label="Duration">
        <div className="space-y-1.5">
          {DURATION_TYPES.map(t => (
            <label key={t} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="duration"
                checked={filters.durationType === t}
                onChange={() =>
                  setFilters(f => ({ ...f, durationType: f.durationType === t ? '' : t }))
                }
                className="w-3.5 h-3.5 border-slate-300 text-blue-900 accent-blue-900"
              />
              <span className="text-xs text-slate-700 group-hover:text-slate-900">{t}</span>
            </label>
          ))}
          {filters.durationType && (
            <button
              onClick={() => setFilters(f => ({ ...f, durationType: '' }))}
              className="text-xs text-slate-400 hover:text-slate-600 mt-0.5"
            >
              Clear
            </button>
          )}
        </div>
      </FilterSection>

      <FilterSection label="Skill level">
        <div className="space-y-1.5">
          {SKILL_LEVELS.map(t => (
            <label key={t} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="skill"
                checked={filters.skillLevel === t}
                onChange={() =>
                  setFilters(f => ({ ...f, skillLevel: f.skillLevel === t ? '' : t }))
                }
                className="w-3.5 h-3.5 border-slate-300 text-blue-900 accent-blue-900"
              />
              <span className="text-xs text-slate-700 group-hover:text-slate-900">{t}</span>
            </label>
          ))}
          {filters.skillLevel && (
            <button
              onClick={() => setFilters(f => ({ ...f, skillLevel: '' }))}
              className="text-xs text-slate-400 hover:text-slate-600 mt-0.5"
            >
              Clear
            </button>
          )}
        </div>
      </FilterSection>

      <FilterSection label="Service type">
        <div className="space-y-1.5">
          {SERVICE_TYPES.map(t => (
            <label key={t} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="service-type"
                checked={filters.serviceType === t}
                onChange={() =>
                  setFilters(f => ({ ...f, serviceType: f.serviceType === t ? '' : t }))
                }
                className="w-3.5 h-3.5 border-slate-300 text-blue-900 accent-blue-900"
              />
              <span className="text-xs text-slate-700 group-hover:text-slate-900">{t} service</span>
            </label>
          ))}
          {filters.serviceType && (
            <button
              onClick={() => setFilters(f => ({ ...f, serviceType: '' }))}
              className="text-xs text-slate-400 hover:text-slate-600 mt-0.5"
            >
              Clear
            </button>
          )}
        </div>
      </FilterSection>

      <FilterSection label="Programme">
        <div className="space-y-1.5">
          {SERVICE_PROGRAMS.map(program => (
            <label key={program.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.servicePrograms.includes(program.value)}
                onChange={() => toggleServiceProgram(program.value)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-900 focus:ring-blue-900/20 accent-blue-900"
              />
              <span className="text-xs text-slate-700 group-hover:text-slate-900">{program.label}</span>
            </label>
          ))}
          {filters.servicePrograms.length > 0 && (
            <button
              onClick={() => setFilters(f => ({ ...f, servicePrograms: [] }))}
              className="text-xs text-slate-400 hover:text-slate-600 mt-0.5"
            >
              Clear
            </button>
          )}
        </div>
      </FilterSection>

    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-900">Browse Opportunities</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {filtered.length} {filtered.length === 1 ? 'result' : 'results'} found
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                  placeholder="Search…"
                  className="input-base pl-8 w-48 sm:w-60"
                />
              </div>
              {/* Sort */}
              <select
                value={filters.sortBy}
                onChange={e => setFilters(f => ({ ...f, sortBy: e.target.value as FilterState['sortBy'] }))}
                className="input-base w-auto"
              >
                <option value="newest">Newest first</option>
                <option value="deadline">Deadline soonest</option>
                <option value="popular">Most popular</option>
              </select>
              {/* Mobile filter button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="btn-secondary lg:hidden relative"
              >
                <FilterIcon size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-900 text-white text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {filters.categories.map(c => (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium hover:bg-blue-100"
                >
                  {c} <XIcon size={10} />
                </button>
              ))}
              {filters.locationType && (
                <button
                  onClick={() => setFilters(f => ({ ...f, locationType: '' }))}
                  className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium hover:bg-blue-100"
                >
                  {filters.locationType} <XIcon size={10} />
                </button>
              )}
              {filters.durationType && (
                <button
                  onClick={() => setFilters(f => ({ ...f, durationType: '' }))}
                  className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium hover:bg-blue-100"
                >
                  {filters.durationType} <XIcon size={10} />
                </button>
              )}
              {filters.skillLevel && (
                <button
                  onClick={() => setFilters(f => ({ ...f, skillLevel: '' }))}
                  className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium hover:bg-blue-100"
                >
                  {filters.skillLevel} <XIcon size={10} />
                </button>
              )}
              {filters.serviceType && (
                <button
                  onClick={() => setFilters(f => ({ ...f, serviceType: '' }))}
                  className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium hover:bg-blue-100"
                >
                  {filters.serviceType} service <XIcon size={10} />
                </button>
              )}
              {filters.servicePrograms.map(program => (
                <button
                  key={program}
                  onClick={() => toggleServiceProgram(program)}
                  className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium hover:bg-blue-100"
                >
                  {program} <XIcon size={10} />
                </button>
              ))}
              <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-700 px-1.5 py-0.5">
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span>{error}</span>
            <button onClick={retry} className="btn-secondary shrink-0">Retry</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="card p-4 sticky top-20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-slate-900">Filters</p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-blue-900 hover:underline">
                  Clear all
                </button>
              )}
            </div>
            <FilterPanel />
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Featured section — only shown when no active filters/search */}
          {activeFilterCount === 0 && !filters.search && (() => {
            const featured = filtered.filter(o => o.featured);
            if (featured.length === 0) return null;
            return (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <StarIcon size={14} className="text-amber-500 fill-amber-500" />
                  <h2 className="text-sm font-semibold text-slate-900">Featured opportunities</h2>
                </div>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {featured.map(opp => (
                    <div key={opp.id} className="relative">
                      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        <StarIcon size={9} className="fill-amber-500 text-amber-500" />
                        Featured
                      </div>
                      <OpportunityCard opportunity={opp} onApply={setApplyTarget} />
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 mt-6" />
              </div>
            );
          })()}

          {loading ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
            ) : filtered.length === 0 && !error ? (
            <EmptyState
              heading="No opportunities found"
              description="Try adjusting your filters or search term to see more results."
              action={
                <button onClick={clearFilters} className="btn-secondary text-xs">
                  Clear all filters
                </button>
              }
            />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(opp => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onApply={setApplyTarget}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative ml-auto w-72 h-full bg-white shadow-xl overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold text-slate-900">Filters</p>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <XIcon size={16} />
              </button>
            </div>
            <FilterPanel />
            <div className="mt-5">
              <button
                onClick={() => setSidebarOpen(false)}
                className="btn-primary w-full justify-center"
              >
                Show {filtered.length} results
              </button>
            </div>
          </div>
        </div>
      )}

      {applyTarget && (
        <ApplicationModal
          opportunity={applyTarget}
          onClose={() => setApplyTarget(null)}
        />
      )}
    </div>
  );
}
