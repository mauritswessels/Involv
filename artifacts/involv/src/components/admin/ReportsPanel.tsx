import { useCallback, useEffect, useState } from 'react';
import { FlagIcon } from 'lucide-react';
import { getMessageReports, reasonLabel, resolveReport, type MessageReport } from '../../services/moderationService';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function ReportCard({ report, onResolved }: { report: MessageReport; onResolved: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function act(resolution: 'dismissed' | 'actioned', remove: boolean) {
    if (remove && !window.confirm('Remove this message for everyone in the group? This cannot be undone.')) return;
    setBusy(true); setError('');
    try { await resolveReport(report.id, resolution, note, remove); onResolved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save the decision.'); setBusy(false); }
  }
  const open = report.status === 'open';
  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{report.activityTitle}</p>
          <p className="text-xs text-slate-500">Reported by {report.reporterName} · {fmt(report.createdAt)} · <span className="font-medium text-red-700">{reasonLabel(report.reason)}</span></p>
        </div>
        {!open && <span className="text-xs rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 capitalize">{report.status}{report.messageRemoved ? ' · message removed' : ''}</span>}
      </div>
      <blockquote className="border-l-4 border-red-200 bg-red-50/40 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap break-words">
        <span className="block text-xs text-slate-500 mb-1">{report.senderName} · {fmt(report.messageSentAt)}{report.messageCurrentlyRemoved ? ' · now removed from the group' : ''}</span>
        {report.messageSnapshot}
      </blockquote>
      {report.details && <p className="text-xs text-slate-600"><span className="font-semibold">Reporter's note:</span> {report.details}</p>}
      {open ? (
        <div className="space-y-2">
          <label className="block text-xs text-slate-600">Internal note (optional, not shown to students)
            <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={2} className="input-base mt-1 text-xs" disabled={busy} />
          </label>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {!report.messageCurrentlyRemoved && (
              <button type="button" disabled={busy} onClick={() => void act('actioned', true)} className="btn-primary text-xs bg-red-700 hover:bg-red-800 disabled:opacity-50">Remove message</button>
            )}
            <button type="button" disabled={busy} onClick={() => void act('actioned', false)} className="btn-secondary text-xs">Handled, keep message</button>
            <button type="button" disabled={busy} onClick={() => void act('dismissed', false)} className="btn-secondary text-xs">Dismiss</button>
          </div>
          <p className="text-xs text-slate-500">The reporter is told their report was reviewed. Follow your school's safeguarding procedure for anything serious.</p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Resolved by {report.resolverName}{report.resolvedAt ? ` · ${fmt(report.resolvedAt)}` : ''}{report.resolutionNote ? ` · ${report.resolutionNote}` : ''}</p>
      )}
    </div>
  );
}

export default function ReportsPanel({ onCountChange }: { onCountChange?: (open: number) => void }) {
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rows = await getMessageReports(filter);
      setReports(rows);
      if (filter === 'open') onCountChange?.(rows.length);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load reports.'); }
    finally { setLoading(false); }
  }, [filter, onCountChange]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(['open', 'closed'] as const).map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border ${filter === f ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-slate-600 border-slate-200'}`}>
            {f === 'open' ? 'Needs review' : 'Resolved'}
          </button>
        ))}
        <button type="button" onClick={() => void load()} className="ml-auto text-xs text-blue-900 underline">Refresh</button>
      </div>
      {error && <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}
      {loading ? <p className="text-sm text-slate-500">Loading reports…</p>
        : reports.length === 0 ? (
          <div className="card p-8 text-center">
            <FlagIcon size={20} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-600 mt-2">{filter === 'open' ? 'No reports waiting for review.' : 'No resolved reports yet.'}</p>
          </div>
        ) : reports.map(r => <ReportCard key={r.id} report={r} onResolved={() => void load()} />)}
    </div>
  );
}
