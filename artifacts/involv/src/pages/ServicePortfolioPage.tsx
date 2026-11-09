import HourReviewHistory from '../components/activity/HourReviewHistory';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ToddleCasExport from '../components/portfolio/ToddleCasExport';
import { ClipboardCopyIcon, DownloadIcon, RefreshCwIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/ui/EmptyState';
import { getMyServicePortfolio, type ServicePortfolio, type PortfolioEntry } from '../services/portfolioService';
import { downloadPortfolioCsv } from '../utils/portfolioCsv';

const STATUS_STYLE: Record<PortfolioEntry['status'], string> = {
  approved: 'bg-green-50 text-green-700',
  pending: 'bg-amber-50 text-amber-700',
  rejected: 'bg-red-50 text-red-700',
};
const STATUS_LABEL: Record<PortfolioEntry['status'], string> = {
  approved: 'Approved - counts as credit',
  pending: 'Pending review - not credit',
  rejected: 'Rejected - not credit',
};
const fmtDate = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const fmtTime = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
};
const hrs = (n: number) => `${Number(n.toFixed(2))} h`;

function PortfolioContent() {
  const [data, setData] = useState<ServicePortfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);
  const alive = useRef(true);

  const load = useCallback(async (initial = false) => {
    const id = ++seq.current;
    if (initial) setLoading(true); else setRefreshing(true);
    try {
      const result = await getMyServicePortfolio();
      if (!alive.current || id !== seq.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (!alive.current || id !== seq.current) return;
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load your service portfolio. Please try again.');
    } finally {
      if (alive.current && id === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load(true);
    const poll = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
    const onFocus = () => void load();
    const onVis = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive.current = false;
      seq.current++;
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const canExport = !!data && !error && !loading && !refreshing && data.entries.length > 0;
  const noCredit = data && data.entries.length > 0 && data.approvedHours === 0;

  const [exporting, setExporting] = useState<string | null>(null);
  const activities = useMemo(() => {
    const map = new Map<string, { opportunityId: string; title: string; approvedHours: number; pending: number; entries: PortfolioEntry[] }>();
    (data?.entries ?? []).forEach(e => {
      const a = map.get(e.opportunityId) ?? { opportunityId: e.opportunityId, title: e.activityTitle, approvedHours: 0, pending: 0, entries: [] };
      a.entries.push(e);
      if (e.status === 'approved') a.approvedHours += e.hours;
      if (e.status === 'pending') a.pending += 1;
      map.set(e.opportunityId, a);
    });
    return [...map.values()];
  }, [data]);
  const exportTarget = activities.find(a => a.opportunityId === exporting) ?? null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 data-testid="text-portfolio-title" className="text-xl font-bold text-slate-900">My service portfolio</h1>
            <p className="text-sm text-slate-500 mt-0.5">A private, honest record of your service contributions and how each was reviewed.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/reflections" className="btn-secondary text-xs">My reflections</Link>
            <button data-testid="button-refresh-portfolio" type="button" onClick={() => void load()} disabled={loading || refreshing} className="btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed">
              <RefreshCwIcon size={13} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
            </button>
            <button data-testid="button-export-portfolio" type="button" onClick={() => data && downloadPortfolioCsv(data.entries)} disabled={!canExport} className="btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed">
              <DownloadIcon size={13} aria-hidden="true" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <p className="text-xs text-slate-500">
          The CSV export includes all of your records with their review statuses (approved, pending, rejected). Only approved rows count as credit.
          {' '}Review times are shown in Swiss local time.
        </p>

        {loading ? (
          <div data-testid="status-portfolio-loading" aria-busy="true" aria-label="Loading portfolio" className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-16 animate-pulse bg-slate-100" />)}
            </div>
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-24 animate-pulse bg-slate-100" />)}
          </div>
        ) : error ? (
          <div data-testid="status-portfolio-error" role="alert" className="card p-6 text-center">
            <p className="text-sm font-semibold text-slate-900 mb-1">Portfolio unavailable</p>
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <button data-testid="button-retry-portfolio" type="button" onClick={() => void load(true)} className="btn-secondary text-xs">Try again</button>
          </div>
        ) : data && (
          <>
            <section aria-label="Totals" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Approved credit', hrs(data.approvedHours), 'text-green-700'],
                ['Approved activities', String(data.approvedActivities), 'text-slate-900'],
                ['Pending (not credit)', hrs(data.pendingHours), 'text-amber-700'],
                ['Rejected (not credit)', hrs(data.rejectedHours), 'text-red-700'],
              ].map(([label, value, color], index) => (
                <div data-testid={`stat-portfolio-${index}`} key={label} className="card p-4">
                  <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
                  <p className="text-xs text-slate-500 mt-1">{label}</p>
                </div>
              ))}
            </section>

            {activities.length > 0 && (
              <section aria-labelledby="toddle-cas-heading" className="card p-4 space-y-3">
                <div>
                  <h2 id="toddle-cas-heading" className="text-sm font-semibold text-slate-900">Add to Toddle CAS</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Toddle stays your official CAS record. Get each activity ready to paste in: title, dates, supervisor, description, approved hours and reflections.</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {activities.map(a => (
                    <li key={a.opportunityId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 break-words">{a.title}</p>
                        <p className="text-xs text-slate-500">{hrs(a.approvedHours)} approved{a.pending ? ` · ${a.pending} pending` : ''}</p>
                      </div>
                      <button type="button" onClick={() => setExporting(a.opportunityId)} className="btn-secondary text-xs">
                        <ClipboardCopyIcon size={13} aria-hidden="true" /> Copy for Toddle
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {noCredit && (
              <p data-testid="status-portfolio-no-credit" role="status" className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                No hours are approved yet. Pending and rejected records are shown below but are not counted as credit.
              </p>
            )}

            {data.entries.length === 0 ? (
              <div data-testid="status-portfolio-empty" className="card">
                <EmptyState
                  heading="No contributions recorded yet"
                  description="Service hours you log in an activity will appear here once recorded."
                  action={<Link data-testid="link-portfolio-dashboard" to="/dashboard" className="btn-secondary text-xs">Back to dashboard</Link>}
                />
              </div>
            ) : (
              <ol className="space-y-3" aria-label="Contributions">
                {data.entries.map(e => (
                  <li data-testid={`contribution-${e.id}`} key={e.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-slate-900 break-words">{e.activityTitle}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          <time dateTime={e.date}>{fmtDate(e.date)}</time> - {e.activityCategory} - {hrs(e.hours)} currently recorded
                        </p>
                      </div>
                      <span data-testid={`status-contribution-${e.id}`} className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
                    </div>
                    {e.description && <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap break-words">{e.description}</p>}
                    <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2">
                      <HourReviewHistory history={e.reviewHistory} />
                      {e.reviewedAt ? (
                        <>
                          <p>Reviewed by {e.reviewerName || 'a reviewer'} on {fmtTime(e.reviewedAt)}</p>
                          {e.reviewNote && <p className="mt-1 text-slate-700 break-words">Note: {e.reviewNote}</p>}
                        </>
                      ) : (
                        <p>Awaiting review. Submitted {fmtTime(e.submittedAt)}.</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
      {exportTarget && (
        <ToddleCasExport opportunityId={exportTarget.opportunityId} activityTitle={exportTarget.title}
          entries={exportTarget.entries} onClose={() => setExporting(null)} />
      )}
    </div>
  );
}

export default function ServicePortfolioPage() {
  const { user } = useAuth();
  useEffect(() => {
    const previous = document.title;
    document.title = 'My service portfolio | Involv';
    return () => { document.title = previous; };
  }, []);
  if (!user) return null;
  return <PortfolioContent key={user.id} />;
}
