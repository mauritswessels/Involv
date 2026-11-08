import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon, BellIcon, BookOpenIcon, CalendarIcon, CameraIcon,
  CheckCircleIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon,
  DownloadIcon, ImageIcon, MegaphoneIcon, MessageSquareIcon, PinIcon,
  PlusIcon, TrophyIcon, UserCheckIcon, XCircleIcon, XIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockOpportunities } from '../data/mockData';
import {
  mockAnnouncements,
  mockSessions,
  mockAttendance,
  mockHours,
  mockReflections,
  mockGallery,
} from '../data/mockActivityData';
import type {
  Announcement, OppSession, AttendanceRecord, HoursEntry, Reflection, GalleryPhoto,
} from '../types';

type TabId = 'announcements' | 'sessions' | 'attendance' | 'hours' | 'reflections' | 'gallery' | 'certificate';

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLOURS = ['bg-blue-900', 'bg-violet-700', 'bg-emerald-700', 'bg-amber-600', 'bg-rose-700'];
function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLOURS.length;
  return AVATAR_COLOURS[idx];
}

// ─── Announcements Tab ────────────────────────────────────────────────────────

function AnnouncementsTab({ isOrganizer }: { isOrganizer: boolean }) {
  const [items, setItems] = useState<Announcement[]>(mockAnnouncements);
  const [composing, setComposing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const pinned = items.filter(a => a.pinned);
  const regular = items.filter(a => !a.pinned);

  const post = () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    setItems(prev => [{
      id: `a-${Date.now()}`,
      opportunityId: '2',
      authorId: 'organizer-1',
      authorName: 'Mr. Okonkwo',
      authorRole: 'Teacher',
      title: newTitle.trim(),
      body: newBody.trim(),
      pinned: false,
      createdAt: new Date().toISOString(),
    }, ...prev]);
    setNewTitle('');
    setNewBody('');
    setComposing(false);
  };

  const togglePin = (id: string) => {
    setItems(prev => prev.map(a => a.id === id ? { ...a, pinned: !a.pinned } : a));
  };

  const AnnouncementCard = ({ a }: { a: Announcement }) => (
    <div className={`p-5 ${a.pinned ? 'bg-amber-50 border border-amber-200 rounded-xl' : 'border-b border-slate-100 last:border-0'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full ${a.authorRole === 'Teacher' ? 'bg-blue-900' : 'bg-violet-700'} text-white text-xs font-semibold flex items-center justify-center shrink-0`}>
          {getInitials(a.authorName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              {a.pinned && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 mb-1">
                  <PinIcon size={10} /> Pinned
                </span>
              )}
              <p className="text-sm font-semibold text-slate-900">{a.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {a.authorName} · {a.authorRole} · {timeAgo(a.createdAt)}
              </p>
            </div>
            {isOrganizer && (
              <button
                onClick={() => togglePin(a.id)}
                className="text-xs text-slate-400 hover:text-amber-600 transition-colors shrink-0"
                title={a.pinned ? 'Unpin' : 'Pin announcement'}
              >
                <PinIcon size={13} />
              </button>
            )}
          </div>
          <p className="text-sm text-slate-700 mt-2 leading-relaxed">{a.body}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {isOrganizer && !composing && (
        <button
          onClick={() => setComposing(true)}
          className="btn-primary w-full justify-center"
        >
          <MegaphoneIcon size={14} /> Post announcement
        </button>
      )}

      {composing && (
        <div className="card p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-900">New announcement</p>
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Title…"
            className="input-base"
          />
          <textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            placeholder="Write your announcement…"
            rows={4}
            className="input-base resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setComposing(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={post} disabled={!newTitle.trim() || !newBody.trim()} className="btn-primary text-sm disabled:opacity-50">Post</button>
          </div>
        </div>
      )}

      {pinned.length > 0 && (
        <div className="space-y-3">
          {pinned.map(a => <AnnouncementCard key={a.id} a={a} />)}
        </div>
      )}

      {regular.length > 0 && (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {regular.map(a => <AnnouncementCard key={a.id} a={a} />)}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <BellIcon size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-slate-600">No announcements yet</p>
          {isOrganizer && <p className="text-xs text-slate-400 mt-1">Post an announcement to keep participants informed.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Sessions / Calendar Tab ──────────────────────────────────────────────────

function SessionsTab({ isOrganizer }: { isOrganizer: boolean }) {
  const [sessions, setSessions] = useState<OppSession[]>(mockSessions);
  const [adding, setAdding] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [form, setForm] = useState({ title: '', date: '', startTime: '15:30', endTime: '17:00', location: '', notes: '' });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const past = sessions.filter(s => new Date(s.date) < today);
  const upcoming = sessions.filter(s => new Date(s.date) >= today);

  const sessionDates = new Set(sessions.map(s => s.date));

  const addSession = () => {
    if (!form.title || !form.date || !form.location) return;
    setSessions(prev => [...prev, {
      id: `s-${Date.now()}`,
      opportunityId: '2',
      ...form,
    }].sort((a, b) => a.date.localeCompare(b.date)));
    setForm({ title: '', date: '', startTime: '15:30', endTime: '17:00', location: '', notes: '' });
    setAdding(false);
  };

  // Mini calendar
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calCells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const SessionCard = ({ s }: { s: OppSession }) => {
    const isPast = new Date(s.date) < today;
    return (
      <div className={`p-4 flex gap-4 ${isPast ? 'opacity-60' : ''}`}>
        <div className="shrink-0 text-center w-12">
          <p className="text-xs font-semibold text-blue-900 uppercase">{new Date(s.date).toLocaleDateString('en-GB', { month: 'short' })}</p>
          <p className="text-2xl font-bold text-slate-900 leading-none">{new Date(s.date).getDate()}</p>
          <p className="text-xs text-slate-400">{new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short' })}</p>
        </div>
        <div className="flex-1 min-w-0 border-l border-slate-100 pl-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">{s.title}</p>
            {isPast && <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 shrink-0">Past</span>}
            {!isPast && <span className="text-xs bg-blue-50 text-blue-900 rounded-full px-2 py-0.5 shrink-0 font-medium">Upcoming</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span className="flex items-center gap-1"><ClockIcon size={11} />{s.startTime} – {s.endTime}</span>
            <span>{s.location}</span>
          </div>
          {s.notes && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{s.notes}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="p-1 rounded hover:bg-slate-100">
            <ChevronLeftIcon size={16} className="text-slate-500" />
          </button>
          <p className="text-sm font-semibold text-slate-900">
            {calMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="p-1 rounded hover:bg-slate-100">
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
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasSession = sessionDates.has(dateStr);
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            return (
              <div
                key={i}
                className={`w-7 h-7 mx-auto flex items-center justify-center rounded-full text-xs relative
                  ${isToday ? 'bg-blue-900 text-white font-bold' : 'text-slate-700'}
                  ${hasSession && !isToday ? 'font-semibold text-blue-900' : ''}`}
              >
                {day}
                {hasSession && !isToday && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-900" />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-blue-900 inline-block" /> Session day
        </div>
      </div>

      {/* Session list */}
      <div className="lg:col-span-2 space-y-4">
        {isOrganizer && !adding && (
          <button onClick={() => setAdding(true)} className="btn-secondary w-full justify-center text-sm">
            <PlusIcon size={14} /> Add session
          </button>
        )}

        {adding && (
          <div className="card p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-900">New session</p>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Session title" className="input-base" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-base" />
              </div>
              <div>
                <label className="label-base">Location</label>
                <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Room 214" className="input-base" />
              </div>
              <div>
                <label className="label-base">Start</label>
                <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="input-base" />
              </div>
              <div>
                <label className="label-base">End</label>
                <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="input-base" />
              </div>
            </div>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} className="input-base resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdding(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={addSession} disabled={!form.title || !form.date || !form.location} className="btn-primary text-sm disabled:opacity-50">Add session</button>
            </div>
          </div>
        )}

        {upcoming.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Upcoming</p>
            <div className="card divide-y divide-slate-100 overflow-hidden">
              {upcoming.map(s => <SessionCard key={s.id} s={s} />)}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Past sessions</p>
            <div className="card divide-y divide-slate-100 overflow-hidden">
              {past.map(s => <SessionCard key={s.id} s={s} />)}
            </div>
          </div>
        )}

        {sessions.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <CalendarIcon size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-slate-600">No sessions scheduled</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(mockAttendance);
  const [selectedSession, setSelectedSession] = useState<string>(mockSessions[0].id);

  const session = mockSessions.find(s => s.id === selectedSession);
  const pastSessions = mockSessions.filter(s => new Date(s.date) <= new Date());

  const sessionAttendance = attendance.filter(a => a.sessionId === selectedSession);

  const allStudents = Array.from(
    new Map(mockAttendance.map(a => [a.studentId, { id: a.studentId, name: a.studentName }])).values()
  );

  const mark = (studentId: string, present: boolean) => {
    setAttendance(prev => {
      const existing = prev.find(a => a.sessionId === selectedSession && a.studentId === studentId);
      if (existing) {
        return prev.map(a =>
          a.sessionId === selectedSession && a.studentId === studentId ? { ...a, present } : a
        );
      }
      const student = allStudents.find(s => s.id === studentId)!;
      return [...prev, {
        id: `at-${Date.now()}-${studentId}`,
        sessionId: selectedSession,
        opportunityId: '2',
        studentId,
        studentName: student.name,
        present,
      }];
    });
  };

  const presentCount = sessionAttendance.filter(a => a.present).length;
  const absentCount = sessionAttendance.filter(a => a.present === false).length;

  return (
    <div className="space-y-4">
      {/* Session selector */}
      <div className="flex gap-2 flex-wrap">
        {pastSessions.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSession(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedSession === s.id
                ? 'bg-blue-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {formatDate(s.date)}
          </button>
        ))}
      </div>

      {session && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">{session.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{formatDate(session.date)} · {session.startTime}–{session.endTime}</p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1 text-green-700 font-medium">
                <CheckCircleIcon size={13} /> {presentCount} present
              </span>
              <span className="flex items-center gap-1 text-red-500 font-medium">
                <XCircleIcon size={13} /> {absentCount} absent
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {allStudents.map(student => {
              const record = sessionAttendance.find(a => a.studentId === student.id);
              const present = record?.present;
              return (
                <div key={student.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${avatarColor(student.name)} text-white text-xs font-semibold flex items-center justify-center shrink-0`}>
                    {getInitials(student.name)}
                  </div>
                  <p className="text-sm font-medium text-slate-900 flex-1">{student.name}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => mark(student.id, true)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        present === true
                          ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                          : 'bg-slate-50 text-slate-500 hover:bg-green-50 hover:text-green-700'
                      }`}
                    >
                      <CheckIcon size={11} /> Present
                    </button>
                    <button
                      onClick={() => mark(student.id, false)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        present === false
                          ? 'bg-red-100 text-red-600 ring-1 ring-red-200'
                          : 'bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600'
                      }`}
                    >
                      <XIcon size={11} /> Absent
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pastSessions.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <UserCheckIcon size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-slate-600">No past sessions yet</p>
          <p className="text-xs text-slate-400 mt-1">Attendance can be marked after a session takes place.</p>
        </div>
      )}
    </div>
  );
}

// ─── Hours Tab ────────────────────────────────────────────────────────────────

function HoursTab({ isOrganizer, currentUserId }: { isOrganizer: boolean; currentUserId: string }) {
  const [hours, setHours] = useState<HoursEntry[]>(mockHours);
  const [logging, setLogging] = useState(false);
  const [form, setForm] = useState({ date: '', hoursStr: '', description: '' });

  const myHours = hours.filter(h => h.studentId === currentUserId);
  const totalApproved = myHours.filter(h => h.status === 'approved').reduce((s, h) => s + h.hours, 0);

  const submit = () => {
    const h = parseFloat(form.hoursStr);
    if (!form.date || !h || !form.description) return;
    setHours(prev => [{
      id: `h-${Date.now()}`,
      opportunityId: '2',
      studentId: currentUserId,
      studentName: 'You',
      date: form.date,
      hours: h,
      description: form.description,
      status: 'pending' as const,
      submittedAt: new Date().toISOString(),
    }, ...prev]);
    setForm({ date: '', hoursStr: '', description: '' });
    setLogging(false);
  };

  const review = (id: string, status: 'approved' | 'rejected') => {
    setHours(prev => prev.map(h => h.id === id ? { ...h, status } : h));
  };

  const StatusPill = ({ status }: { status: HoursEntry['status'] }) => {
    const map = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-600',
    };
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${map[status]}`}>
        {status}
      </span>
    );
  };

  const displayRows = isOrganizer ? hours : myHours;

  return (
    <div className="space-y-4">
      {/* Stats row for students */}
      {!isOrganizer && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Approved hours', value: totalApproved.toFixed(1), color: 'text-green-700 bg-green-50' },
            { label: 'Pending review', value: myHours.filter(h => h.status === 'pending').length, color: 'text-amber-700 bg-amber-50' },
            { label: 'Total logged', value: myHours.reduce((s, h) => s + h.hours, 0).toFixed(1), color: 'text-blue-900 bg-blue-50' },
          ].map(stat => (
            <div key={stat.label} className={`card p-3 text-center ${stat.color.split(' ')[1]}`}>
              <p className={`text-xl font-bold ${stat.color.split(' ')[0]}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {!isOrganizer && !logging && (
        <button onClick={() => setLogging(true)} className="btn-secondary w-full justify-center">
          <PlusIcon size={14} /> Log service hours
        </button>
      )}

      {logging && (
        <div className="card p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-900">Log service hours</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-base" />
            </div>
            <div>
              <label className="label-base">Hours</label>
              <input type="number" min="0.5" max="8" step="0.5" value={form.hoursStr} onChange={e => setForm(f => ({ ...f, hoursStr: e.target.value }))} placeholder="1.5" className="input-base" />
            </div>
          </div>
          <div>
            <label className="label-base">What did you do?</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of activities…" rows={3} className="input-base resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setLogging(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={submit} disabled={!form.date || !form.hoursStr || !form.description} className="btn-primary text-sm disabled:opacity-50">Submit</button>
          </div>
        </div>
      )}

      <div className="card divide-y divide-slate-100 overflow-hidden">
        {displayRows.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <ClockIcon size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-slate-600">No hours logged yet</p>
          </div>
        ) : displayRows.map(h => (
          <div key={h.id} className="p-4 flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full ${avatarColor(h.studentName)} text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5`}>
              {getInitials(h.studentName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  {isOrganizer && <p className="text-xs font-semibold text-slate-700">{h.studentName}</p>}
                  <p className="text-sm text-slate-900 leading-snug">{h.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(h.date)} · {h.hours}h
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill status={h.status} />
                  {isOrganizer && h.status === 'pending' && (
                    <div className="flex gap-1">
                      <button onClick={() => review(h.id, 'approved')} className="p-1 rounded text-green-600 hover:bg-green-50 transition-colors" title="Approve">
                        <CheckIcon size={14} />
                      </button>
                      <button onClick={() => review(h.id, 'rejected')} className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors" title="Reject">
                        <XIcon size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Reflections Tab ──────────────────────────────────────────────────────────

function ReflectionsTab({ isOrganizer, currentUserId }: { isOrganizer: boolean; currentUserId: string }) {
  const [reflections, setReflections] = useState<Reflection[]>(mockReflections);
  const [writing, setWriting] = useState(false);
  const [content, setContent] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const MIN_WORDS = 30;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  const submit = () => {
    if (wordCount < MIN_WORDS) return;
    setReflections(prev => [{
      id: `r-${Date.now()}`,
      opportunityId: '2',
      studentId: currentUserId,
      studentName: 'You',
      content: content.trim(),
      submittedAt: new Date().toISOString(),
    }, ...prev]);
    setContent('');
    setWriting(false);
  };

  const myReflections = isOrganizer ? reflections : reflections.filter(r => r.studentId === currentUserId || r.studentId === 'student-priya');
  const displayReflections = isOrganizer ? reflections : myReflections;

  return (
    <div className="space-y-4">
      {!isOrganizer && !writing && (
        <button onClick={() => setWriting(true)} className="btn-secondary w-full justify-center">
          <BookOpenIcon size={14} /> Write a reflection
        </button>
      )}

      {writing && (
        <div className="card p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 mb-0.5">New reflection</p>
            <p className="text-xs text-slate-500">Reflect on what you did, what you learnt, and how it went. Minimum {MIN_WORDS} words.</p>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write about your experience in today's session…"
            rows={6}
            className="input-base resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <p className={`text-xs ${wordCount >= MIN_WORDS ? 'text-green-600 font-medium' : 'text-slate-400'}`}>
              {wordCount} / {MIN_WORDS} words minimum
            </p>
            <div className="flex gap-2">
              <button onClick={() => { setWriting(false); setContent(''); }} className="btn-secondary text-sm">Cancel</button>
              <button onClick={submit} disabled={wordCount < MIN_WORDS} className="btn-primary text-sm disabled:opacity-50">Submit</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {displayReflections.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BookOpenIcon size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-slate-600">No reflections yet</p>
            {!isOrganizer && <p className="text-xs text-slate-400 mt-1">Reflections help you track your growth and build your portfolio.</p>}
          </div>
        ) : displayReflections.map(r => {
          const isExpanded = expandedId === r.id;
          const preview = r.content.slice(0, 180);
          const needsTruncation = r.content.length > 180;
          return (
            <div key={r.id} className="card p-5">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full ${avatarColor(r.studentName)} text-white text-xs font-semibold flex items-center justify-center shrink-0`}>
                  {getInitials(r.studentName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-slate-700">{r.studentName}</p>
                    <p className="text-xs text-slate-400">{timeAgo(r.submittedAt)}</p>
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {needsTruncation && !isExpanded ? `${preview}…` : r.content}
                  </p>
                  {needsTruncation && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className="text-xs text-blue-900 hover:underline mt-1.5"
                    >
                      {isExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Gallery Tab ──────────────────────────────────────────────────────────────

function GalleryTab({ isOrganizer }: { isOrganizer: boolean }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(mockGallery);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);

  const addPhoto = () => {
    const colors = ['from-blue-400 to-indigo-500', 'from-emerald-400 to-teal-500', 'from-violet-400 to-purple-600', 'from-amber-400 to-orange-500'];
    setPhotos(prev => [...prev, {
      id: `g-${Date.now()}`,
      opportunityId: '2',
      uploaderId: 'you',
      uploaderName: 'You',
      color: colors[Math.floor(Math.random() * colors.length)],
      caption: 'New photo',
      uploadedAt: new Date().toISOString(),
    }]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
        <button onClick={addPhoto} className="btn-secondary text-sm">
          <CameraIcon size={14} /> Upload photo
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ImageIcon size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-slate-600">No photos yet</p>
          <p className="text-xs text-slate-400 mt-1">Share moments from your sessions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map(photo => (
            <button
              key={photo.id}
              onClick={() => setLightbox(photo)}
              onMouseEnter={() => setHoveredId(photo.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative aspect-square rounded-xl overflow-hidden group focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2"
            >
              <div className={`w-full h-full bg-gradient-to-br ${photo.color}`} />
              <div className={`absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-end p-3 ${hoveredId === photo.id ? 'bg-black/30' : ''}`}>
                {photo.caption && (
                  <p className={`text-white text-xs font-medium leading-snug drop-shadow transition-opacity ${hoveredId === photo.id ? 'opacity-100' : 'opacity-0'}`}>
                    {photo.caption}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className={`w-full h-64 bg-gradient-to-br ${lightbox.color}`} />
            <div className="p-4">
              <p className="text-sm font-medium text-slate-900">{lightbox.caption ?? 'No caption'}</p>
              <p className="text-xs text-slate-500 mt-1">Uploaded by {lightbox.uploaderName} · {timeAgo(lightbox.uploadedAt)}</p>
            </div>
            <div className="px-4 pb-4 flex justify-end gap-2">
              <button onClick={() => setLightbox(null)} className="btn-secondary text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Certificate Tab ──────────────────────────────────────────────────────────

function CertificateTab({ opportunityTitle, studentName, approvedHours }: {
  opportunityTitle: string;
  studentName: string;
  approvedHours: number;
}) {
  const hasEarned = approvedHours >= 3;

  if (!hasEarned) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <TrophyIcon size={28} className="text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-900 mb-1">Certificate not yet earned</p>
        <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
          Complete the programme and have at least 3 approved service hours to earn your digital certificate.
        </p>
        <div className="mt-5 mx-auto max-w-xs">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
            <span>Approved hours</span>
            <span className="font-semibold">{approvedHours} / 3</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="bg-blue-900 h-2 rounded-full transition-all" style={{ width: `${Math.min((approvedHours / 3) * 100, 100)}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        {/* Certificate preview */}
        <div className="bg-gradient-to-br from-blue-950 to-blue-800 p-8 text-white text-center relative">
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
              <TrophyIcon size={26} className="text-amber-300" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200 mb-2">Certificate of Completion</p>
            <p className="text-xs text-blue-300 mb-4">This is to certify that</p>
            <p className="text-2xl font-bold text-white mb-3">{studentName}</p>
            <p className="text-xs text-blue-200 leading-relaxed max-w-xs mx-auto mb-4">
              has successfully completed the service-learning opportunity
            </p>
            <p className="text-base font-semibold text-amber-300 mb-4 max-w-xs mx-auto leading-snug">
              {opportunityTitle}
            </p>
            <div className="flex items-center justify-center gap-6 text-center">
              <div>
                <p className="text-xl font-bold text-white">{approvedHours}h</p>
                <p className="text-xs text-blue-300">service hours</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div>
                <p className="text-sm font-semibold text-white">{today}</p>
                <p className="text-xs text-blue-300">date issued</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 bg-white">
          <p className="text-xs text-slate-500 text-center mb-4">
            This certificate is digitally verified and can be shared with universities, employers, and portfolios.
          </p>
          <div className="flex gap-3 justify-center">
            <button className="btn-primary gap-2">
              <DownloadIcon size={14} /> Download PDF
            </button>
            <button className="btn-secondary gap-2">Share certificate</button>
          </div>
        </div>
      </div>

      <div className="card p-4 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <TrophyIcon size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-900">Congratulations!</p>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              You have completed this service-learning opportunity. This achievement has been recorded on your Involv profile and can be included in university applications and CVs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// Retained prototype for the deferred attendance/hours/reflection/gallery work.
// The live route uses the database-backed foundation below, never these fixtures.
export function ActivityHubPrototype() {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>('announcements');

  const opportunity = mockOpportunities.find(o => o.id === opportunityId);
  const isOrganizer = user?.role === 'organizer' || user?.role === 'teacher';
  const currentUserId = user?.id ?? 'student-priya';

  const myApprovedHours = mockHours
    .filter(h => h.studentId === currentUserId && h.status === 'approved')
    .reduce((s, h) => s + h.hours, 0);

  if (!opportunity) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-medium text-slate-600">Opportunity not found.</p>
          <Link to="/dashboard" className="btn-secondary mt-4">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const allTabs: { id: TabId; label: string; icon: React.ReactNode; orgOnly?: boolean }[] = [
    { id: 'announcements', label: 'Announcements', icon: <MegaphoneIcon size={14} /> },
    { id: 'sessions', label: 'Sessions', icon: <CalendarIcon size={14} /> },
    { id: 'attendance', label: 'Attendance', icon: <UserCheckIcon size={14} />, orgOnly: true },
    { id: 'hours', label: 'Hours', icon: <ClockIcon size={14} /> },
    { id: 'reflections', label: 'Reflections', icon: <BookOpenIcon size={14} /> },
    { id: 'gallery', label: 'Gallery', icon: <ImageIcon size={14} /> },
    { id: 'certificate', label: 'Certificate', icon: <TrophyIcon size={14} /> },
  ];
  const tabs = allTabs.filter(t => !t.orgOnly || isOrganizer);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-4 border-b border-slate-100">
            <Link
              to={isOrganizer ? `/applications/${opportunityId}` : '/dashboard'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
            >
              <ArrowLeftIcon size={16} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{opportunity.title}</p>
              <p className="text-xs text-slate-500">Activity hub</p>
            </div>
            <Link
              to={`/chat/${opportunityId}`}
              className="btn-secondary text-xs gap-1.5 shrink-0"
            >
              <MessageSquareIcon size={13} /> Chat
            </Link>
          </div>

          {/* Tab nav */}
          <div className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-blue-900 text-blue-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {tab === 'announcements' && <AnnouncementsTab isOrganizer={isOrganizer} />}
        {tab === 'sessions' && <SessionsTab isOrganizer={isOrganizer} />}
        {tab === 'attendance' && isOrganizer && <AttendanceTab />}
        {tab === 'hours' && <HoursTab isOrganizer={isOrganizer} currentUserId={currentUserId} />}
        {tab === 'reflections' && <ReflectionsTab isOrganizer={isOrganizer} currentUserId={currentUserId} />}
        {tab === 'gallery' && <GalleryTab isOrganizer={isOrganizer} />}
        {tab === 'certificate' && !isOrganizer && (
          <CertificateTab
            opportunityTitle={opportunity.title}
            studentName={user?.name ?? 'Student'}
            approvedHours={myApprovedHours}
          />
        )}
      </div>
    </div>
  );
}

export { default } from './ActivityHubFoundation';
