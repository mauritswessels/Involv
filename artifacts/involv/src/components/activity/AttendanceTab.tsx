import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircleIcon, CheckIcon, UserCheckIcon, XCircleIcon, XIcon } from 'lucide-react';
import { markAttendance } from '../../services/participationService';
import type { ActivityAttendance } from '../../services/participationService';
import type { OppSession } from '../../types';

interface Props {
  opportunityId: string;
  canManage: boolean;
  userId: string;
  sessions: OppSession[];
  participants: { id: string; name: string }[];
  items: ActivityAttendance[];
  onChanged: () => Promise<void>;
}

function zurichToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function formatStamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export default function AttendanceTab({ opportunityId, canManage, userId, sessions, participants, items, onChanged }: Props) {
  const [selected, setSelected] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const manageRef = useRef(canManage);
  manageRef.current = canManage;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setSelected(''); setError(''); setStatus(''); }, [opportunityId]);

  const today = zurichToday();
  const eligible = useMemo(
    () => sessions.filter(s => s.date <= today).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)),
    [sessions, today],
  );
  // Removed or ineligible selection falls back to the most recent eligible session.
  const session = eligible.find(s => s.id === selected) ?? eligible[eligible.length - 1];

  const roster = useMemo(() => {
    const seen = new Set<string>();
    return participants.filter(p => !seen.has(p.id) && seen.add(p.id));
  }, [participants]);
  const mine = useMemo(() => items.filter(a => a.studentId === userId), [items, userId]);

  async function mark(studentId: string, value: boolean | null) {
    if (!manageRef.current || busyRef.current || !session) return;
    busyRef.current = true;
    setBusyKey(`${session.id}:${studentId}`);
    setError(''); setStatus('');
    try {
      await markAttendance(session.id, studentId, value);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Could not save attendance. Please try again.');
      busyRef.current = false;
      if (mounted.current) setBusyKey('');
      return;
    }
    try {
      await onChanged();
      if (mounted.current) setStatus('Attendance saved.');
    } catch (e) {
      if (mounted.current) setError(`Saved, but the list could not refresh. ${e instanceof Error ? e.message : 'Reload the page.'}`);
    }
    busyRef.current = false;
    if (mounted.current) setBusyKey('');
  }

  const busy = busyKey !== '';
  const banner = (
    <>
      <div aria-live="polite">
        {status && <p role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{status}</p>}
      </div>
      {error && <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
    </>
  );

  const empty = (
    <div className="text-center py-12 text-slate-400">
      <UserCheckIcon size={32} className="mx-auto mb-3 opacity-40" />
      <p className="text-sm font-medium text-slate-600">No sessions to record yet</p>
      <p className="text-xs text-slate-400 mt-1">
        {canManage ? 'Attendance can be marked on or after the session date (Europe/Zurich).' : 'Your attendance will appear here after sessions take place.'}
      </p>
    </div>
  );

  if (!canManage) {
    return (
      <div className="space-y-4">
        {banner}
        {eligible.length === 0 ? empty : (
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {[...eligible].reverse().map(s => {
              const rec = mine.find(a => a.sessionId === s.id);
              const p = rec?.present;
              return (
                <div key={s.id} className="px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 break-words">{s.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDate(s.date)} · {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p === true ? 'bg-green-100 text-green-700' : p === false ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                      {p === true ? 'Present' : p === false ? 'Absent' : 'Not marked'}
                    </span>
                    {rec && p !== null && rec.updatedAt && (
                      <p className="text-[11px] text-slate-400 mt-1">Marked {formatStamp(rec.updatedAt)}{rec.markedByName ? ` by ${rec.markedByName}` : ''}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const records = session ? items.filter(a => a.sessionId === session.id) : [];
  const byStudent = new Map(records.map(r => [r.studentId, r]));
  const presentCount = roster.filter(p => byStudent.get(p.id)?.present === true).length;
  const absentCount = roster.filter(p => byStudent.get(p.id)?.present === false).length;
  const unmarked = roster.length - presentCount - absentCount;

  return (
    <div className="space-y-4">
      {banner}
      {eligible.length === 0 ? empty : (
        <>
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Select session">
            {eligible.map(s => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                aria-pressed={session?.id === s.id}
                onClick={() => { setSelected(s.id); setError(''); setStatus(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                  session?.id === s.id ? 'bg-blue-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {formatDate(s.date)}
              </button>
            ))}
          </div>
          {session && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 break-words">{session.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatDate(session.date)} · {session.startTime.slice(0, 5)}–{session.endTime.slice(0, 5)} (Europe/Zurich)</p>
                </div>
                <div className="flex gap-3 text-xs" aria-label="Attendance counts">
                  <span className="flex items-center gap-1 text-green-700 font-medium"><CheckCircleIcon size={13} /> {presentCount} present</span>
                  <span className="flex items-center gap-1 text-red-500 font-medium"><XCircleIcon size={13} /> {absentCount} absent</span>
                  <span className="text-slate-500 font-medium">{unmarked} unmarked</span>
                </div>
              </div>
              {roster.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">No accepted participants to mark yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {roster.map(st => {
                    const rec = byStudent.get(st.id);
                    const p = rec?.present ?? null;
                    const rowBusy = busyKey === `${session.id}:${st.id}`;
                    return (
                      <div key={st.id} className="px-5 py-3.5 flex items-center gap-3 flex-wrap">
                        <div className="w-8 h-8 rounded-full bg-blue-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">{getInitials(st.name)}</div>
                        <div className="flex-1 min-w-[8rem]">
                          <p className="text-sm font-medium text-slate-900 break-words">{st.name}</p>
                          {rec && p !== null && rec.updatedAt && (
                            <p className="text-[11px] text-slate-400">Marked {formatStamp(rec.updatedAt)}{rec.markedByName ? ` by ${rec.markedByName}` : ''}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button" disabled={busy} aria-pressed={p === true}
                            aria-label={`Mark ${st.name} present`}
                            onClick={() => mark(st.id, true)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${p === true ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-slate-50 text-slate-500 hover:bg-green-50 hover:text-green-700'}`}
                          ><CheckIcon size={11} /> Present</button>
                          <button
                            type="button" disabled={busy} aria-pressed={p === false}
                            aria-label={`Mark ${st.name} absent`}
                            onClick={() => mark(st.id, false)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${p === false ? 'bg-red-100 text-red-600 ring-1 ring-red-200' : 'bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600'}`}
                          ><XIcon size={11} /> Absent</button>
                          <button
                            type="button" disabled={busy || p === null}
                            aria-label={`Clear attendance for ${st.name}`}
                            onClick={() => mark(st.id, null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                          >{rowBusy ? 'Saving…' : 'Clear'}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
