import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  GraduationCapIcon,
  GlobeIcon,
  HeartIcon,
  LeafIcon,
  MonitorIcon,
  PaletteIcon,
  SearchIcon,
  TrendingUpIcon,
  UsersIcon,
} from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import OpportunityCard from '../components/opportunities/OpportunityCard';
import ApplicationModal from '../components/opportunities/ApplicationModal';
import { useStats } from '../hooks/useStats';
import { useOpportunities } from '../hooks/useOpportunities';
import type { Opportunity } from '../types';

const CATEGORIES = [
  { name: 'Community & Social Impact', icon: UsersIcon, color: 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100' },
  { name: 'Health & Wellbeing', icon: HeartIcon, color: 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100' },
  { name: 'Sustainability & Environment', icon: LeafIcon, color: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
  { name: 'Global & Humanitarian', icon: GlobeIcon, color: 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100' },
  { name: 'Arts, Culture & Media', icon: PaletteIcon, color: 'text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { name: 'School-Based Service', icon: GraduationCapIcon, color: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100' },
  { name: 'Business, Leadership & Management', icon: TrendingUpIcon, color: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { name: 'Technology & Innovation', icon: MonitorIcon, color: 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
  { name: 'Education & Mentorship', icon: BookOpenIcon, color: 'text-violet-700 bg-violet-50 border-violet-200 hover:bg-violet-100' },
] as const;

const STEPS = [
  {
    number: '01',
    title: 'Build your profile',
    description: 'Add your interests, skills, and availability so organisers can learn about you when you apply.',
    icon: '👤',
  },
  {
    number: '02',
    title: 'Browse and apply',
    description: 'Search by category, time commitment, skill level, and more. Apply in minutes with your saved profile details.',
    icon: '🔍',
  },
  {
    number: '03',
    title: 'Track your impact',
    description: 'Check your application status, submit service hours for staff review, and keep reflections on your experience.',
    icon: '🏆',
  },
];

const FEATURES = [
  { label: 'Application tracking', icon: CheckCircleIcon },
  { label: 'Session calendar', icon: CheckCircleIcon },
  { label: 'Hours log & approval', icon: CheckCircleIcon },
  { label: 'Private reflections', icon: CheckCircleIcon },
  { label: 'Announcements & chat', icon: CheckCircleIcon },
  { label: 'Attendance tracker', icon: CheckCircleIcon },
];

function StatCounter({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-blue-900 tabular-nums">
        {value === null ? '—' : value}
      </p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default function LandingPage() {
  const [search, setSearch] = useState('');
  const [applyTarget, setApplyTarget] = useState<Opportunity | null>(null);
  const navigate = useNavigate();
  const { stats, loading: statsLoading, retry: retryStats } = useStats();
  const { opportunities, loading: activitiesLoading, error: activitiesError, retry: retryActivities } = useOpportunities();

  const highlighted = opportunities.filter(o => o.featured);
  const featured = (highlighted.length ? highlighted : opportunities).slice(0, 3);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/browse?q=${encodeURIComponent(search)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative bg-white overflow-hidden">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="flex justify-center mb-6">
            <img src="/logo.png" alt="Involv" className="h-32 w-auto" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-[1.1] mb-5">
            A clearer way to organise<br />
            <span className="text-blue-900">service learning.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 mb-8 max-w-xl mx-auto leading-relaxed">
            Find, apply for, and track service-learning opportunities that match your interests,
            skills, and schedule — all in one place, with tools your organisers will actually use.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto mb-6">
            <div className="relative flex-1">
              <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search opportunities…"
                className="input-base pl-9"
              />
            </div>
            <button type="submit" className="btn-primary px-5">
              Search
            </button>
          </form>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/login" className="btn-primary px-6 py-2.5 text-sm">
              Get started
            </Link>
            <Link to="/browse" className="btn-ghost text-sm">
              Browse opportunities <ArrowRightIcon size={13} />
            </Link>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            For verified @iszl.ch accounts. School Google sign-in may require approval from school IT.
          </p>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center mb-8">
            <img src="/favicon.png" alt="" aria-hidden="true" className="h-12 w-12 mb-4" />
            <p className="text-xs font-semibold text-blue-900 uppercase tracking-[0.18em] mb-2">Start with what matters</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Find your way to make an impact.</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-md">Choose a direction and discover opportunities built around the things you care about.</p>
          </div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-base font-bold text-slate-900 tracking-tight border-l-2 border-blue-900 pl-2">
              Explore categories
            </h3>
            <Link to="/browse" className="text-xs text-blue-900 font-medium hover:underline flex items-center gap-1">
              See all <ArrowRightIcon size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const count = opportunities.filter(o => o.category === cat.name).length;
              return (
                <Link
                  key={cat.name}
                  to={`/browse?category=${encodeURIComponent(cat.name)}`}
                  className={`group relative min-h-[128px] flex flex-col justify-between overflow-hidden rounded-md px-5 py-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${cat.color}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Icon size={23} strokeWidth={1.8} className="shrink-0 opacity-80" />
                    <ArrowRightIcon size={17} className="opacity-45 transition-transform group-hover:translate-x-1 group-hover:opacity-100" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-snug">{cat.name}</p>
                    <p className="text-xs opacity-65 mt-1">{count} {count === 1 ? 'listing' : 'listings'}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-slate-200 py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 divide-x divide-slate-100">
            <StatCounter value={stats?.activeOpportunities ?? null} label="Published opportunities" />
            <StatCounter value={CATEGORIES.length} label="Categories" />
            <StatCounter value={stats?.acceptedApplications ?? null} label="Accepted applications" />
            <StatCounter value={stats?.applicationsSubmitted ?? null} label="Applications on record" />
          </div>
          {statsLoading && <p role="status" className="text-center text-xs text-slate-500 mt-4">Loading platform counts…</p>}
          {!statsLoading && !stats && <p role="status" className="text-center text-xs text-slate-500 mt-4">
            Platform counts are unavailable. <button type="button" onClick={retryStats} className="underline">Retry</button>
          </p>}
        </div>
      </section>

      {/* ── Featured Opportunities ───────────────────────────────────────────── */}
      <section className="bg-white border-y border-slate-200 py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Current opportunities</h2>
              <p className="text-sm text-slate-500 mt-0.5">Published activities from Involv. Check each listing for application dates.</p>
            </div>
            <Link to="/browse" className="text-xs text-blue-900 font-medium hover:underline flex items-center gap-1">
              Browse all <ArrowRightIcon size={12} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activitiesLoading && <p role="status" className="text-sm text-slate-500">Loading activities…</p>}
            {activitiesError && <div role="alert" className="text-sm text-red-800">
              {activitiesError} <button type="button" className="underline" onClick={retryActivities}>Retry</button>
            </div>}
            {!activitiesLoading && !activitiesError && featured.length === 0 && <p className="text-sm text-slate-500">
              No activities are published yet. Your school’s pilot activities will appear here once added.
            </p>}
            {featured.map(opp => (
              <OpportunityCard key={opp.id} opportunity={opp} onApply={setApplyTarget} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-lg font-bold text-slate-900 mb-2">How Involv works</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">Find an activity, apply, and keep a record of your service learning.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden sm:block absolute top-8 left-1/6 right-1/6 h-px bg-slate-200" style={{ left: '16%', right: '16%' }} />
            {STEPS.map((step, i) => (
              <div key={step.number} className="flex flex-col items-center text-center gap-4 relative">
                <div className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-200 shadow-sm flex items-center justify-center text-2xl relative z-10">
                  {step.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">Step {i + 1}</p>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-slate-200 py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-2">Tools for the pilot</p>
              <h2 className="text-xl font-bold text-slate-900 mb-3 leading-snug">
                More than just a listing board.
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Keep applications, activity updates, attendance, and reviewed service hours in
                one place. Students can also write reflections that classmates can't see.
              </p>
              <Link to="/login" className="btn-primary">
                Get started <ArrowRightIcon size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {FEATURES.map(f => (
                <div key={f.label} className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <CheckCircleIcon size={14} className="text-blue-900 shrink-0" />
                  <p className="text-xs font-medium text-slate-700">{f.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA for organisers ───────────────────────────────────────────────── */}
      <section className="bg-blue-950 py-14">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide mb-3">For teachers & organisers</p>
          <h2 className="text-xl font-bold text-white mb-3 leading-snug">
            Stop managing sign-ups in your inbox.
          </h2>
          <p className="text-sm text-blue-200 mb-7 leading-relaxed max-w-md mx-auto">
            Post opportunities, review applications, track attendance, approve hours, and communicate
            with your group — all from a single dashboard.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/login" className="inline-flex items-center gap-1.5 bg-white text-blue-900 text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-50 transition-colors">
              Get started <ArrowRightIcon size={13} />
            </Link>
            <Link to="/browse" className="text-sm text-blue-300 hover:text-white transition-colors">
              Browse opportunities
            </Link>
          </div>
        </div>
      </section>

      <Footer />

      {applyTarget && (
        <ApplicationModal opportunity={applyTarget} onClose={() => setApplyTarget(null)} />
      )}
    </div>
  );
}
