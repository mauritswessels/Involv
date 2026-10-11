import type { HourReview } from '../../services/hourCorrectionService';

export default function HourReviewHistory({ history }: { history: HourReview[] }) {
  if (!history.length) return null;
  return <details className="mt-3 text-xs rounded-lg border border-slate-200 p-3">
    <summary className="cursor-pointer font-semibold text-slate-700">Review and correction history ({history.length})</summary>
    <ol className="mt-3 space-y-3">
      {history.map(r => <li key={r.id} className="border-l-2 border-slate-200 pl-3">
        <p className="font-semibold text-slate-800">
          {r.kind === 'baseline' ? 'Existing decision at setup' : r.kind === 'review' ? 'Original review' : 'Correction'}
          {' · '}{r.actor_name || 'Reviewer'}
        </p>
        <p className="text-slate-600">
          {r.before_state && <>{r.before_state.hours}h ({r.before_state.status}) → </>}
          {r.after_state.hours}h ({r.after_state.status})
          {r.after_state.status === 'rejected' && ' · 0 credited hours'}
        </p>
        <p className="text-slate-500">{new Date(r.after_state.reviewed_at || r.recorded_at).toLocaleString('en-GB', { timeZone: 'Europe/Zurich' })} · Europe/Zurich</p>
        {r.reason && <p className="mt-1 whitespace-pre-wrap break-words">{r.reason}</p>}
        {r.kind === 'baseline' && <p className="mt-1 text-slate-500">Earlier changes were not recorded by this history feature.</p>}
      </li>)}
    </ol>
  </details>;
}
