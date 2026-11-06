import { useRef, useState, type FormEvent } from 'react';
import { FlagIcon } from 'lucide-react';
import { REPORT_REASONS, reportMessage, type ReportReason } from '../../services/moderationService';

/** "Report" link under someone else's message; sends it to school admins. */
export default function ReportMessageButton({ messageId, enabled }: { messageId: string; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const sending = useRef(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) { setError('Choose a reason.'); return; }
    if (sending.current) return;
    sending.current = true; setBusy(true); setError('');
    try {
      await reportMessage(messageId, reason, details);
      setDone(true); setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the report. Please try again.');
    } finally { sending.current = false; setBusy(false); }
  }

  if (done) return <p role="status" className="mt-1 text-xs text-slate-500">Reported. A school admin will review it.</p>;
  if (!open) {
    return (
      <button type="button" disabled={!enabled} onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-700 disabled:opacity-50"
        aria-label="Report this message">
        <FlagIcon size={11} /> Report
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="mt-2 bg-white rounded-lg border border-slate-300 p-3 space-y-2 text-xs text-slate-800">
      <p className="font-semibold">Report this message to a school admin</p>
      <p className="text-slate-500">The person who wrote it is not told who reported it. If someone is in danger, tell a teacher straight away.</p>
      <label className="block">Reason
        <select value={reason} onChange={e => setReason(e.target.value as ReportReason)} disabled={busy}
          className="input-base mt-1 text-xs" required>
          <option value="">Choose…</option>
          {REPORT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
      <label className="block">Anything else the admin should know? (optional)
        <textarea value={details} onChange={e => setDetails(e.target.value)} maxLength={1000} rows={2}
          disabled={busy} className="input-base mt-1 text-xs" />
      </label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !enabled} className="btn-primary text-xs disabled:opacity-50">{busy ? 'Sending…' : 'Send report'}</button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(''); }} className="btn-secondary text-xs">Cancel</button>
      </div>
    </form>
  );
}
