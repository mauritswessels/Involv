import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { deleteSession, saveSession } from '../../services/activityService';
import type { OppSession } from '../../types';

interface Props {
  opportunityId: string;
  canManage: boolean;
  items: OppSession[];
  onChanged: () => Promise<void>;
}

interface Form { title: string; date: string; startTime: string; endTime: string; location: string; notes: string }
const EMPTY: Form = { title: '', date: '', startTime: '15:30', endTime: '17:00', location: '', notes: '' };
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function localDate(date: string) {
  return new Date(`${date}T00:00:00`);
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = localDate(s);
  return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === s;
}

function validate(f: Form): string | null {
  const title = f.title.trim();
  const location = f.location.trim();
  if (title.length < 1) return 'Enter a session title.';
  if (title.length > 160) return 'Title must be 160 characters or fewer.';
  if (!f.date || !validDate(f.date)) return 'Choose a valid session date.';
  if (!TIME_RE.test(f.startTime)) return 'Choose a start time.';
  if (!TIME_RE.test(f.endTime)) return 'Choose an end time.';
  if (f.endTime <= f.startTime) return 'End time must be after the start time on the same day.';
  if (location.length < 1) return 'Enter a location.';
  if (location.length > 200) return 'Location must be 200 characters or fewer.';
  if (f.notes.trim().length > 2000) return 'Notes must be 2,000 characters or fewer.';
  return null;
}

export default function SessionsTab({ opportunityId, canManage, items, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date());
  const mounted = useRef(true);
  const manageRef = useRef(canManage);
  const busyRef = useRef(false);
  manageRef.current = canManage;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!canManage) {
      setEditingId(null);
      setConfirmId(null);
      setForm(EMPTY);
    }
  }, [canManage]);

  useEffect(() => {
    setEditingId(null);
    setConfirmId(null);
    setForm(EMPTY);
    setError('');
    setStatus('');
  }, [opportunityId]);

  const sessions = useMemo(
    () => [...items].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime)),
    [items],
  );
  const today = todayStr();
  const upcoming = sessions.filter(s => s.date >= today);
  const past = sessions.filter(s => s.date < today);
  const sessionDates = new Set(sessions.map(s => s.date));

  async function run(action: () => Promise<void>, success: string): Promise<boolean> {
    if (!manageRef.current || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await action();
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Could not save changes. Please try again.');
      busyRef.current = false;
      if (mounted.current) setBusy(false);
      return false;
    }
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

  function openNew() {
    if (!canManage || busy) return;
    setForm(EMPTY);
    setEditingId('new');
    setConfirmId(null);
    setError('');
    setStatus('');
  }

  function openEdit(s: OppSession) {
    if (!canManage || busy) return;
    setForm({
      title: s.title, date: s.date, startTime: s.startTime.slice(0, 5), endTime: s.endTime.slice(0, 5),
      location: s.location, notes: s.notes ?? '',
    });
    setEditingId(s.id);
    setConfirmId(null);
    setError('');
    setStatus('');
  }

  function cancel() {
    if (busy) return;
    setEditingId(null);
    setForm(EMPTY);
    setError('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage || busy || !editingId) return;
    const problem = validate(form);
    if (problem) { setError(problem); setStatus(''); return; }
    const id = editingId === 'new' ? undefined : editingId;
    const ok = await run(
      () => saveSession(opportunityId, {
        title: form.title.trim(), date: form.date, startTime: form.startTime, endTime: form.endTime,
        location: form.location.trim(), notes: form.notes.trim(),
      }, id),
      id ? 'Session updated.' : 'Session added.',
    );
    if (ok && mounted.current) { setEditingId(null); setForm(EMPTY); }
  }

  async function remove(s: OppSession) {
    const ok = await run(() => deleteSession(opportunityId, s.id), 'Session deleted.');
    if (ok && mounted.current) {
      setConfirmId(null);
      if (editingId === s.id) { setEditingId(null); setForm(EMPTY); }
    }
  }

  const formOpen = canManage && editingId !== null;

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const renderCard = (s: OppSession) => {
    const isPast = s.date < today;
    const d = localDate(s.date);
    return (
      <div key={s.id} className="p-4">
        <div className={`flex gap-4 ${isPast ? 'opacity-70' : ''}`}>
          <div className="shrink-0 text-center w-12">
            <p className="text-xs font-semibold text-blue-900 uppercase">{d.toLocaleDateString('en-GB', { month: 'short' })}</p>
            <p className="text-2xl font-bold text-slate-900 leading-none">{d.getDate()}</p>
            <p className="text-xs text-slate-400">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
          </div>
          <div className="flex-1 min-w-0 border-l border-slate-100 pl-4">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-900 break-words min-w-0">{s.title}</p>
              <div className="flex items-center gap-1 shrink-0">
                {isPast
                  ? <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">Past</span>
                  : <span className="text-xs bg-blue-50 text-blue-900 rounded-full px-2 py-0.5 font-medium">Upcoming</span>}
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      disabled={busy}
                      aria-label={`Edit session: ${s.title}`}
                      title="Edit"
                      className="p-1.5 rounded text-slate-400 hover:text-blue-900 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <PencilIcon size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setConfirmId(s.id); setError(''); setStatus(''); }}
                      disabled={busy}
                      aria-label={`Delete session: ${s.title}`}
                      title="Delete"
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <Trash2Icon size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
              <span className="flex items-center gap-1"><ClockIcon size={11} />{s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)} (Europe/Zurich)</span>
              <span className="break-words">{s.location}</span>
            </div>
            {s.notes && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed whitespace-pre-wrap break-words">{s.notes}</p>}
          </div>
        </div>
        {canManage && confirmId === s.id && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-800 flex-1 min-w-[12rem]">Delete this session? This cannot be undone.</p>
            <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => setConfirmId(null)}>Keep</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => remove(s)}
              aria-label={`Confirm delete session: ${s.title}`}
              className="inline-flex items-center justify-center gap-1.5 bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="card p-4 self-start">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="p-1 rounded hover:bg-slate-100"
          >
            <ChevronLeftIcon size={16} className="text-slate-500" />
          </button>
          <p className="text-sm font-semibold text-slate-900" aria-live="polite">
            {calMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="p-1 rounded hover:bg-slate-100"
          >
            <ChevronRightIcon size={16} className="text-slate-500" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <p key={i} className="text-xs font-medium text-slate-400 py-1">{d}</p>
          ))}
        </div>
        <div className="grid grid-cols-7 text-center gap-y-1">
          {calCells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
            const hasSession = sessionDates.has(dateStr);
            const isToday = dateStr === today;
            return (
              <div
                key={i}
                aria-label={hasSession ? `${dateStr}, session scheduled` : undefined}
                className={`w-7 h-7 mx-auto flex items-center justify-center rounded-full text-xs relative
                  ${isToday ? 'bg-blue-900 text-white font-bold' : 'text-slate-700'}
                  ${hasSession && !isToday ? 'font-semibold text-blue-900' : ''}`}
              >
                {day}
                {hasSession && (
                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isToday ? 'bg-white' : 'bg-blue-900'}`} />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-blue-900 inline-block" /> Session day · times in Europe/Zurich
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4 min-w-0">
        <div aria-live="polite">
          {status && (
            <p role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{status}</p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {canManage && !formOpen && (
          <button type="button" onClick={openNew} disabled={busy} className="btn-secondary w-full justify-center text-sm disabled:opacity-50">
            <PlusIcon size={14} /> Add session
          </button>
        )}

        {formOpen && (
          <form key={editingId} onSubmit={submit} noValidate className="card p-5 space-y-3" aria-busy={busy}>
            <p className="text-sm font-semibold text-slate-900">{editingId === 'new' ? 'New session' : 'Edit session'}</p>
            <div>
              <label htmlFor="session-title" className="label-base">Session title</label>
              <input id="session-title" type="text" value={form.title} disabled={busy}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-base" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="session-date" className="label-base">Session date</label>
                <input id="session-date" type="date" value={form.date} disabled={busy}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-base" />
              </div>
              <div>
                <label htmlFor="session-location" className="label-base">Location</label>
                <input id="session-location" type="text" value={form.location} disabled={busy} placeholder="Room 214"
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="input-base" />
              </div>
              <div>
                <label htmlFor="session-start" className="label-base">Start time</label>
                <input id="session-start" type="time" value={form.startTime} disabled={busy}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="input-base" />
              </div>
              <div>
                <label htmlFor="session-end" className="label-base">End time</label>
                <input id="session-end" type="time" value={form.endTime} disabled={busy}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="input-base" />
              </div>
            </div>
            <p className="text-xs text-slate-500">Times are school time (Europe/Zurich).</p>
            <div>
              <label htmlFor="session-notes" className="label-base">Session notes</label>
              <textarea id="session-notes" value={form.notes} rows={3} disabled={busy} placeholder="Optional"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-base resize-y" />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={cancel} disabled={busy} className="btn-secondary text-sm disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">
                {busy ? 'Saving…' : editingId === 'new' ? 'Add session' : 'Save changes'}
              </button>
            </div>
          </form>
        )}

        {upcoming.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Upcoming</p>
            <div className="card divide-y divide-slate-100 overflow-hidden">{upcoming.map(renderCard)}</div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Past sessions</p>
            <div className="card divide-y divide-slate-100 overflow-hidden">{past.map(renderCard)}</div>
          </div>
        )}

        {sessions.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <CalendarIcon size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-slate-600">No sessions scheduled</p>
            {canManage && <p className="text-xs text-slate-400 mt-1">Add the first session so participants can plan ahead.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
