import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckIcon, ClockIcon, PencilIcon, PlusIcon, RefreshCwIcon, XIcon } from 'lucide-react';
import { reviewHours, saveHours, withdrawHours } from '../../services/participationService';
import type { ActivityHours } from '../../services/participationService';

interface Props {
  opportunityId: string;
  canManage: boolean;
  canSubmit: boolean;
  userId: string;
  items: ActivityHours[];
  onChanged: () => Promise<void>;
}

interface Form { date: string; hoursStr: string; description: string }
interface Editing { mode: 'new' | 'edit'; snapshot?: ActivityHours }
interface Review { snapshot: ActivityHours; decision: 'approved' | 'rejected'; note: string }

const EMPTY: Form = { date: '', hoursStr: '', description: '' };

function zurichToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function formatStamp(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}
const fmt = (n: number) => (Math.round(n * 100) / 100).toString();
const sum = (xs: ActivityHours[]) => xs.reduce((s, h) => s + h.hours, 0);

function validate(f: Form): { error: string | null; hours: number } {
  const hours = Number(f.hoursStr);
  const desc = f.description.trim();
  if (!f.date) return { error: 'Choose the service date.', hours };
  if (f.date > zurichToday()) return { error: 'The service date cannot be in the future.', hours };
  if (!f.hoursStr.trim() || !Number.isFinite(hours) || hours <= 0) return { error: 'Hours must be greater than 0.', hours };
  if (hours > 24) return { error: 'Hours cannot be more than 24.', hours };
  if (!/^\d+(\.\d{1,2})?$/.test(f.hoursStr.trim())) return { error: 'Hours can have at most 2 decimal places.', hours };
  if (desc.length < 1) return { error: 'Describe what you did.', hours };
  if (desc.length > 2000) return { error: 'Description must be 2000 characters or fewer.', hours };
  return { error: null, hours };
}

const PILL = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};

export default function HoursTab({ opportunityId, canManage, canSubmit, userId, items, onChanged }: Props) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [review, setReview] = useState<Review | null>(null);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const manageRef = useRef(canManage);
  const submitRef = useRef(canSubmit);
  manageRef.current = canManage;
  submitRef.current = canSubmit;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setEditing(null); setReview(null); setWithdrawId(null); setForm(EMPTY); setError(''); setStatus('');
  }, [opportunityId, userId]);
  useEffect(() => {
    if (!canSubmit) { setEditing(null); setWithdrawId(null); setForm(EMPTY); }
  }, [canSubmit]);
  useEffect(() => { if (!canManage) setReview(null); }, [canManage]);

  const rows = useMemo(
    () => (canManage ? items : items.filter(h => h.studentId === userId))
      .slice().sort((a, b) => b.date.localeCompare(a.date) || b.submittedAt.localeCompare(a.submittedAt)),
    [items, canManage, userId],
  );
  const mine = useMemo(() => items.filter(h => h.studentId === userId), [items, userId]);

  const current = (id: string) => items.find(h => h.id === id);
  const editStale = editing?.mode === 'edit' && editing.snapshot
    ? (() => { const c = current(editing.snapshot.id); return !c || c.updatedAt !== editing.snapshot.updatedAt || c.status !== 'pending'; })()
    : false;
  const reviewStale = review
    ? (() => { const c = current(review.snapshot.id); return !c || c.updatedAt !== review.snapshot.updatedAt || c.status !== 'pending'; })()
    : false;

  async function run(action: () => Promise<void>, success: string, allowed: () => boolean): Promise<boolean> {
    if (!allowed() || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true); setError(''); setStatus('');
    try {
      await action();
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      busyRef.current = false;
      if (mounted.current) setBusy(false);
      return false;
    }
    // Close forms before refreshing so a refresh failure cannot cause a repeat write.
    if (mounted.current) { setEditing(null); setForm(EMPTY); setReview(null); setWithdrawId(null); }
    try {
      await onChanged();
      if (mounted.current) setStatus(success);
    } catch (e) {
      if (mounted.current) setError(`Saved, but the list could not refresh. ${e instanceof Error ? e.message : 'Reload the page.'}`);
    }
    busyRef.current = false;
    if (mounted.current) setBusy(false);
    return true;
  }

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try { await onChanged(); if (mounted.current) setError(''); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not refresh.'); }
    if (mounted.current) setRefreshing(false);
  }

  function openNew(prefill?: ActivityHours) {
    if (!canSubmit || busy) return;
    setForm(prefill ? { date: prefill.date, hoursStr: fmt(prefill.hours), description: prefill.description } : EMPTY);
    setEditing({ mode: 'new' }); setReview(null); setWithdrawId(null); setError(''); setStatus('');
  }
  function openEdit(h: ActivityHours) {
    if (!canSubmit || busy || h.studentId !== userId || h.status !== 'pending') return;
    setForm({ date: h.date, hoursStr: fmt(h.hours), description: h.description });
    setEditing({ mode: 'edit', snapshot: h }); setReview(null); setWithdrawId(null); setError(''); setStatus('');
  }
  function closeForm() { if (busy) return; setEditing(null); setForm(EMPTY); setError(''); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy || !editing) return;
    if (editStale) { setError('This entry changed while you were editing. Refresh to see the latest version.'); return; }
    const v = validate(form);
    if (v.error) { setError(v.error); setStatus(''); return; }
    const snap = editing.snapshot;
    await run(
      () => saveHours(opportunityId, { date: form.date, hours: v.hours, description: form.description.trim() }, snap),
      snap ? 'Hours updated.' : 'Hours submitted for review.',
      () => submitRef.current,
    );
  }

  async function withdraw(h: ActivityHours) {
    if (h.studentId !== userId || h.status !== 'pending') return;
    await run(() => withdrawHours(h), 'Entry withdrawn.', () => submitRef.current);
  }

  function openReview(h: ActivityHours, decision: 'approved' | 'rejected') {
    if (!canManage || busy || h.studentId === userId || h.status !== 'pending') return;
    setReview({ snapshot: h, decision, note: '' }); setEditing(null); setWithdrawId(null); setError(''); setStatus('');
  }

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    if (!canManage || busy || !review) return;
    if (reviewStale) { setError('This entry changed since you opened it. Refresh before reviewing.'); return; }
    if (review.snapshot.studentId === userId) { setError('You cannot review your own entry.'); return; }
    const note = review.note.trim();
    if (review.decision === 'rejected' && note.length < 1) { setError('Give a reason for rejecting these hours.'); return; }
    if (note.length > 1000) { setError('Note must be 1000 characters or fewer.'); return; }
    const { snapshot, decision } = review;
    await run(() => reviewHours(snapshot, decision, note), decision === 'approved' ? 'Hours approved.' : 'Hours rejected.', () => manageRef.current);
  }

  const stat = (label: string, value: string, tone: string) => (
    <div className={`card p-3 text-center ${tone.split(' ')[1]}`}>
      <p className={`text-xl font-bold ${tone.split(' ')[0]}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
  const stats = (list: ActivityHours[], title: string) => (
    <section aria-label={title} className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      <div className="grid grid-cols-3 gap-3">
        {stat('Approved hours', fmt(sum(list.filter(h => h.status === 'approved'))), 'text-green-700 bg-green-50')}
        {stat('Pending hours', fmt(sum(list.filter(h => h.status === 'pending'))), 'text-amber-700 bg-amber-50')}
        {stat('Rejected hours', fmt(sum(list.filter(h => h.status === 'rejected'))), 'text-red-600 bg-red-50')}
      </div>
    </section>
  );

  const stale = editStale || reviewStale;

  return (
    <div className="space-y-4">
      <div aria-live="polite">
        {status && <p role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{status}</p>}
      </div>
      {error && <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {stale && (
        <div role="alert" className="flex items-center gap-2 flex-wrap text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="flex-1 min-w-[12rem]">This entry was updated by someone else. Refresh to continue.</span>
          <button type="button" onClick={refresh} disabled={refreshing} className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCwIcon size={12} /> {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}

      {canManage && stats(items, 'Activity total (all participants)')}
      {(canSubmit || mine.length > 0) && stats(mine, canManage ? 'Your own hours' : 'Your hours')}
      <p className="text-xs text-slate-500">Only approved hours count toward your total. Dates are in Europe/Zurich.</p>

      {canSubmit && !editing && (
        <button type="button" onClick={() => openNew()} disabled={busy} className="btn-secondary w-full justify-center disabled:opacity-50">
          <PlusIcon size={14} /> Log service hours
        </button>
      )}

      {canSubmit && editing && (
        <form onSubmit={submit} noValidate aria-busy={busy} className="card p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-900">{editing.mode === 'edit' ? 'Edit pending hours' : 'Log service hours'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="hours-date" className="label-base">Service date</label>
              <input id="hours-date" type="date" value={form.date} max={zurichToday()} disabled={busy}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-base" />
            </div>
            <div>
              <label htmlFor="hours-amount" className="label-base">Hours</label>
              <input id="hours-amount" type="number" inputMode="decimal" min="0.01" max="24" step="0.01" value={form.hoursStr} disabled={busy}
                onChange={e => setForm(f => ({ ...f, hoursStr: e.target.value }))} placeholder="1.5" className="input-base" />
            </div>
          </div>
          <div>
            <label htmlFor="hours-desc" className="label-base">What did you do?</label>
            <textarea id="hours-desc" value={form.description} rows={3} maxLength={2000} disabled={busy}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-base resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={closeForm} disabled={busy} className="btn-secondary text-sm disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy || editStale} className="btn-primary text-sm disabled:opacity-50">
              {busy ? 'Saving…' : editing.mode === 'edit' ? 'Save changes' : 'Submit'}
            </button>
          </div>
        </form>
      )}

      {canManage && review && (
        <form onSubmit={submitReview} noValidate aria-busy={busy} className="card p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            {review.decision === 'approved' ? 'Approve' : 'Reject'} {fmt(review.snapshot.hours)}h from {review.snapshot.studentName}
          </p>
          <div>
            <label htmlFor="review-note" className="label-base">
              {review.decision === 'rejected' ? 'Reason for rejection (required)' : 'Note (optional)'}
            </label>
            <textarea id="review-note" value={review.note} rows={3} maxLength={1000} disabled={busy}
              onChange={e => setReview(r => (r ? { ...r, note: e.target.value } : r))} className="input-base resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" disabled={busy} onClick={() => { setReview(null); setError(''); }} className="btn-secondary text-sm disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy || reviewStale}
              className={review.decision === 'approved' ? 'btn-primary text-sm disabled:opacity-50' : 'inline-flex items-center justify-center bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50'}>
              {busy ? 'Saving…' : review.decision === 'approved' ? 'Confirm approval' : 'Confirm rejection'}
            </button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-slate-100 overflow-hidden">
        {rows.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <ClockIcon size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-slate-600">No hours logged yet</p>
          </div>
        ) : rows.map(h => {
          const own = h.studentId === userId;
          const pending = h.status === 'pending';
          return (
            <div key={h.id} className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-900 text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">{getInitials(h.studentName)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    {canManage && <p className="text-xs font-semibold text-slate-700">{own ? `${h.studentName} (you)` : h.studentName}</p>}
                    <p className="text-sm text-slate-900 leading-snug whitespace-pre-wrap break-words">{h.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(h.date)} · {fmt(h.hours)}h · submitted {formatStamp(h.submittedAt)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${PILL[h.status]}`}>{h.status}</span>
                </div>

                {!pending && (h.reviewerName || h.reviewedAt || h.reviewNote) && (
                  <div className={`mt-2 text-xs rounded-lg px-3 py-2 ${h.status === 'rejected' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                    <p className="font-medium">
                      {h.status === 'approved' ? 'Approved' : 'Rejected'}
                      {h.reviewerName ? ` by ${h.reviewerName}` : ''}{h.reviewedAt ? ` · ${formatStamp(h.reviewedAt)}` : ''}
                    </p>
                    {h.reviewNote && <p className="mt-0.5 whitespace-pre-wrap break-words">{h.reviewNote}</p>}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {own && pending && canSubmit && (
                    <>
                      <button type="button" disabled={busy} onClick={() => openEdit(h)} aria-label={`Edit pending entry from ${formatDate(h.date)}`}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-blue-900 px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-50">
                        <PencilIcon size={12} /> Edit
                      </button>
                      <button type="button" disabled={busy} onClick={() => { setWithdrawId(h.id); setError(''); setStatus(''); }}
                        aria-label={`Withdraw pending entry from ${formatDate(h.date)}`}
                        className="text-xs text-slate-600 hover:text-red-600 px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-50">Withdraw</button>
                    </>
                  )}
                  {own && h.status === 'rejected' && canSubmit && (
                    <button type="button" disabled={busy} onClick={() => openNew(h)} aria-label={`Submit again, based on rejected entry from ${formatDate(h.date)}`}
                      className="text-xs text-blue-900 font-medium px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50">Submit again</button>
                  )}
                  {canManage && pending && !own && (
                    <>
                      <button type="button" disabled={busy} onClick={() => openReview(h, 'approved')} aria-label={`Approve ${fmt(h.hours)} hours from ${h.studentName}`}
                        className="inline-flex items-center gap-1 text-xs text-green-700 px-2 py-1 rounded hover:bg-green-50 disabled:opacity-50">
                        <CheckIcon size={13} /> Approve
                      </button>
                      <button type="button" disabled={busy} onClick={() => openReview(h, 'rejected')} aria-label={`Reject ${fmt(h.hours)} hours from ${h.studentName}`}
                        className="inline-flex items-center gap-1 text-xs text-red-600 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
                        <XIcon size={13} /> Reject
                      </button>
                    </>
                  )}
                  {canManage && pending && own && (
                    <p className="text-xs text-slate-500">You cannot review your own entry. Another organizer must approve or reject it.</p>
                  )}
                </div>

                {own && withdrawId === h.id && pending && canSubmit && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-800 flex-1 min-w-[12rem]">Withdraw this pending entry? It will be removed.</p>
                    <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => setWithdrawId(null)}>Keep</button>
                    <button type="button" disabled={busy} onClick={() => withdraw(h)} aria-label={`Confirm withdraw entry from ${formatDate(h.date)}`}
                      className="inline-flex items-center justify-center bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
                      {busy ? 'Withdrawing…' : 'Withdraw'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
