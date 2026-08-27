import { useState, useEffect, useRef } from 'react';
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
  StarIcon,
  TrendingUpIcon,
  UsersIcon,
} from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import OpportunityCard from '../components/opportunities/OpportunityCard';
import ApplicationModal from '../components/opportunities/ApplicationModal';
import { useStats } from '../hooks/useStats';
import { mockOpportunities } from '../data/mockData';
import type { Opportunity } from '../types';

const CATEGORIES = [
  { name: 'Sustainability & Environment', icon: LeafIcon, color: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
  { name: 'Community & Social Impact', icon: UsersIcon, color: 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100' },
  { name: 'Health & Wellbeing', icon: HeartIcon, color: 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100' },
  { name: 'Education & Mentorship', icon: BookOpenIcon, color: 'text-violet-700 bg-violet-50 border-violet-200 hover:bg-violet-100' },
  { name: 'Arts, Culture & Media', icon: PaletteIcon, color: 'text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { name: 'Technology & Innovation', icon: MonitorIcon, color: 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
  { name: 'Business, Leadership & Management', icon: TrendingUpIcon, color: 'text-slate-700 bg-slate-100 border-slate-200 hover:bg-slate-200' },
  { name: 'Global & Humanitarian', icon: GlobeIcon, color: 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100' },
  { name: 'School-Based Service', icon: GraduationCapIcon, color: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100' },
] as const;

const STEPS = [
  {
    number: '01',
    title: 'Build your profile',
    description: 'Set your interests, skills, and availability. Involv learns what you care about and surfaces the most relevant opportunities.',
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
    description: 'Monitor application status, log service hours, write reflections, and earn a digital certificate on completion.',
    icon: '🏆',
  },
];

const TESTIMONIALS = [
  {
    quote: 'I found an environmental volunteer programme in 10 minutes that perfectly matched my schedule. Got accepted, completed it, and now have a verified certificate on my university application.',
    name: 'Priya S.',
    role: 'Year 12 student',
    initials: 'PS',
    color: 'bg-violet-700',
  },
  {
    quote: 'As a teacher, managing applications through school email was a nightmare. Involv gives me a proper dashboard — I can see who applied, update statuses, and message the whole group instantly.',
    name: 'Mr. Okonkwo',
    role: 'Teacher, Maths & Science',
    initials: 'AO',
    color: 'bg-blue-900',
  },
  {
    quote: "I run the school's sustainability committee and we used Involv to manage our clean-up campaign sign-ups. The attendance tracker and reflection journal saved us hours of admin every week.",
    name: 'Marcus A.',
    role: 'Student organiser, Year 13',
    initials: 'MA',
    color: 'bg-emerald-700',
  },
];

const FEATURES = [
  { label: 'Application tracking', icon: CheckCircleIcon },
  { label: 'Session calendar', icon: CheckCircleIcon },
  { label: 'Hours log & approval', icon: CheckCircleIcon },
  { label: 'Reflection journal', icon: CheckCircleIcon },
  { label: 'Digital certificates', icon: CheckCircleIcon },
  { label: 'Announcements & chat', icon: CheckCircleIcon },
  { label: 'Attendance tracker', icon: CheckCircleIcon },
  { label: 'Photo gallery', icon: CheckCircleIcon },
];

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useRef(false);
  const latestTarget = useRef(target);

  // Always keep latest target in ref
  latestTarget.current = target;

  function runAnimation(to: number) {
    const start = Date.now();
    const from = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + ease * (to - from)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Re-run animation whenever target changes (i.e. real data arrives)
  useEffect(() => {
    if (inView.current && target > 0) runAnimation(target);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !inView.current) {
          inView.current = true;
          runAnimation(latestTarget.current);
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { value, ref };
}

function StatCounter({ value, suffix = '', label }: { value: number; suffix?: string; label: string }) {
  const { value: displayed, ref } = useCountUp(value);
  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl font-bold text-blue-900 tabular-nums">
        {displayed}{suffix}
      </p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default function LandingPage() {
  const [search, setSearch] = useState('');
  const [applyTarget, setApplyTarget] = useState<Opportunity | null>(null);
  const navigate = useNavigate();
  const { stats } = useStats();

  const featured = mockOpportunities.filter(o => o.featured).slice(0, 3);

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
              const count = mockOpportunities.filter(o => o.category === cat.name).length;
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
            <StatCounter value={stats?.activeOpportunities ?? 0} suffix="+" label="Active opportunities" />
            <StatCounter value={9} label="Categories" />
            <StatCounter value={stats?.studentsEnrolled ?? 0} suffix="+" label="Students enrolled" />
            <StatCounter value={stats?.applicationsSubmitted ?? 0} suffix="+" label="Applications submitted" />
          </div>
        </div>
      </section>

      {/* ── Featured Opportunities ───────────────────────────────────────────── */}
      <section className="bg-white border-y border-slate-200 py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Featured opportunities</h2>
              <p className="text-sm text-slate-500 mt-0.5">Handpicked by our team. Applications open now.</p>
            </div>
            <Link to="/browse" className="text-xs text-blue-900 font-medium hover:underline flex items-center gap-1">
              Browse all <ArrowRightIcon size={12} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <p className="text-sm text-slate-500 max-w-md mx-auto">From sign-up to certificate, everything is in one place.</p>
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
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-2">Everything you need</p>
              <h2 className="text-xl font-bold text-slate-900 mb-3 leading-snug">
                More than just a listing board.
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Involv gives students and organisers a complete toolkit — from first application
                to final certificate — so nothing gets lost in email chains or Schoology posts.
              </p>
              <Link to="/login" className="btn-primary">
                Get started free <ArrowRightIcon size={14} />
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

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-lg font-bold text-slate-900 mb-1">What people are saying</h2>
            <p className="text-sm text-slate-500">From students, teachers, and organisers.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="card p-6 flex flex-col gap-4">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <StarIcon key={s} size={12} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed flex-1">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  <div className={`w-8 h-8 rounded-full ${t.color} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
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
              Get started for free <ArrowRightIcon size={13} />
            </Link>
            <Link to="/browse" className="text-sm text-blue-300 hover:text-white transition-colors">
              See a demo listing
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
