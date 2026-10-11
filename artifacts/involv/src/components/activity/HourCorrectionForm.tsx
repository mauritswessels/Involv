import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ActivityHours } from '../../services/participationService';
import { correctHours } from '../../services/hourCorrectionService';

interface Props {
  entry: ActivityHours; stale: boolean; onCancel: () => void;
  onSaved: () => void; onChanged: () => Promise<void>;
}
export default function HourCorrectionForm({ entry, stale, onCancel, onSaved, onChanged }: Props) {
  const [hours, setHours] = useState(String(entry.hours));
  const [decision, setDecision] = useState<'approved' | 'rejected'>(entry.status === 'approved' ? 'approved' : 'rejected');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Retry an uncertain write with the same request ID. Changing a payload gets a new ID.
  const request = useRef({ id: crypto.randomUUID(), payload: '' });
  const writing = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [saved, setSaved] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (writing.current || stale || saved) return;
    const n = Number(hours);
    if (!Number.isFinite(n) || n <= 0 || n > 24 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-8
      || !reason.trim() || reason.trim().length > 1000) {
      setError('Enter 0.01–24 hours with up to two decimals and a correction reason.'); return;
    }
    if (n === entry.hours && decision === entry.status) { setError('Change the hours or decision before saving.'); return; }
    const payload = JSON.stringify([n, decision, reason.trim()]);
    if (request.current.payload && request.current.payload !== payload) request.current.id = crypto.randomUUID();
    request.current.payload = payload;
    writing.current = true; setBusy(true); setError('');
    try {
      await correctHours(entry, n, decision, reason, request.current.id);
    } catch (e) {
      if (mounted.current) { setError(e instanceof Error ? e.message : 'Could not confirm the correction.'); setBusy(false); }
      writing.current = false; return;
    }
    if (!mounted.current) return;
    setSaved(true);
    try { await onChanged(); if (mounted.current) onSaved(); }
    catch { if (mounted.current) setError('Correction saved, but the list could not refresh. Refresh before making another correction.'); }
    writing.current = false; if (mounted.current) setBusy(false);
  }
  return <form onSubmit={submit} className="card p-4 border border-amber-200 space-y-3">
    <h3 className="font-semibold text-sm text-slate-900">Correct reviewed hours — {entry.studentName}</h3>
    <p className="text-xs text-slate-600">Current: {entry.hours}h, {entry.status}. The previous decision stays in the history. Date and original description are not changed.</p>
    {stale && !saved && <p role="alert" className="text-sm text-red-700">This entry changed. Cancel, refresh, and reopen the correction.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset disabled={busy || saved} className="space-y-3">
      <label className="block text-sm">Correct decision
        <select value={decision} onChange={e => setDecision(e.target.value as typeof decision)} className="input-base mt-1">
          <option value="approved">Approved — count these hours</option>
          <option value="rejected">Rejected — count zero hours</option>
        </select>
      </label>
      <label className="block text-sm">Recorded hours
        <input type="number" min="0.01" max="24" step="0.01" required value={hours} onChange={e => setHours(e.target.value)} className="input-base mt-1" />
      </label>
      <p className="text-xs text-slate-500">The student’s approved total will change by {((decision === 'approved' ? Number(hours) || 0 : 0) - (entry.status === 'approved' ? entry.hours : 0)).toLocaleString('en-GB', { maximumFractionDigits: 2 })}h. Rejected hours stay in the record but count as zero credit.</p>
      <label className="block text-sm">Reason for correction
        <textarea required maxLength={1000} rows={3} value={reason} onChange={e => setReason(e.target.value)} className="input-base mt-1" />
      </label>
    </fieldset>
    <div className="flex flex-wrap gap-2">
      {!saved && <button type="submit" disabled={busy || stale} className="btn-primary text-sm disabled:opacity-50">{busy ? 'Saving…' : 'Confirm correction'}</button>}
      <button type="button" disabled={busy} onClick={onCancel} className="btn-secondary text-sm">{saved ? 'Close saved correction' : 'Cancel'}</button>
    </div>
  </form>;
}
