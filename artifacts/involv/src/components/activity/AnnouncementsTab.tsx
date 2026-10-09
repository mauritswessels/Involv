import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { BellIcon, MegaphoneIcon, PencilIcon, PinIcon, Trash2Icon } from 'lucide-react';
import { deleteAnnouncement, saveAnnouncement, setAnnouncementPinned } from '../../services/activityService';
import type { Announcement } from '../../types';

interface Props {
  opportunityId: string;
  canManage: boolean;
  items: Announcement[];
  onChanged: () => Promise<void>;
}

interface Form { title: string; body: string; pinned: boolean }
const EMPTY: Form = { title: '', body: '', pinned: false };

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function validate(f: Form): string | null {
  const title = f.title.trim();
  const body = f.body.trim();
  if (title.length < 1) return 'Enter an announcement title.';
  if (title.length > 160) return 'Title must be 160 characters or fewer.';
  if (body.length < 1) return 'Enter an announcement body.';
  if (body.length > 10000) return 'Body must be 10,000 characters or fewer.';
  return null;
}

export default function AnnouncementsTab({ opportunityId, canManage, items, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const mounted = useRef(true);
  const manageRef = useRef(canManage);
  const busyRef = useRef(false);
  manageRef.current = canManage;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Revocation: close any active form / confirmation immediately.
  useEffect(() => {
    if (!canManage) {
      setEditingId(null);
      setConfirmId(null);
      setForm(EMPTY);
    }
  }, [canManage]);

  // Opportunity switch: reset everything.
  useEffect(() => {
    setEditingId(null);
    setConfirmId(null);
    setForm(EMPTY);
    setError('');
    setStatus('');
  }, [opportunityId]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
    [items],
  );

  // Returns true if the save succeeded.
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

  function openEdit(a: Announcement) {
    if (!canManage || busy) return;
    setForm({ title: a.title, body: a.body, pinned: a.pinned });
    setEditingId(a.id);
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
      () => saveAnnouncement(opportunityId, { title: form.title.trim(), body: form.body.trim(), pinned: form.pinned }, id),
      id ? 'Announcement updated.' : 'Announcement posted.',
    );
    if (ok && mounted.current) { setEditingId(null); setForm(EMPTY); }
  }

  async function togglePin(a: Announcement) {
    await run(() => setAnnouncementPinned(opportunityId, a.id, !a.pinned), a.pinned ? 'Announcement unpinned.' : 'Announcement pinned.');
  }

  async function remove(a: Announcement) {
    const ok = await run(() => deleteAnnouncement(opportunityId, a.id), 'Announcement deleted.');
    if (ok && mounted.current) {
      setConfirmId(null);
      if (editingId === a.id) { setEditingId(null); setForm(EMPTY); }
    }
  }

  const formOpen = canManage && editingId !== null;

  const renderCard = (a: Announcement) => (
    <div
      key={a.id}
      className={`p-5 ${a.pinned ? 'bg-amber-50 border border-amber-200 rounded-xl' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full ${a.authorRole === 'Teacher' ? 'bg-blue-900' : 'bg-violet-700'} text-white text-xs font-semibold flex items-center justify-center shrink-0`}>
          {getInitials(a.authorName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              {a.pinned && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 mb-1">
                  <PinIcon size={10} /> Pinned
                </span>
              )}
              <p className="text-sm font-semibold text-slate-900 break-words">{a.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {a.authorName} · {a.authorRole} · {timeAgo(a.createdAt)}
              </p>
            </div>
            {canManage && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => togglePin(a)}
                  disabled={busy}
                  aria-pressed={a.pinned}
                  aria-label={`${a.pinned ? 'Unpin' : 'Pin'} announcement: ${a.title}`}
                  title={a.pinned ? 'Unpin' : 'Pin announcement'}
                  className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  <PinIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  disabled={busy}
                  aria-label={`Edit announcement: ${a.title}`}
                  title="Edit"
                  className="p-1.5 rounded text-slate-400 hover:text-blue-900 hover:bg-slate-100 disabled:opacity-50"
                >
                  <PencilIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmId(a.id); setError(''); setStatus(''); }}
                  disabled={busy}
                  aria-label={`Delete announcement: ${a.title}`}
                  title="Delete"
                  className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  <Trash2Icon size={14} />
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-700 mt-2 leading-relaxed whitespace-pre-wrap break-words">{a.body}</p>
          {canManage && confirmId === a.id && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800 flex-1 min-w-[12rem]">Delete this announcement? This cannot be undone.</p>
              <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => setConfirmId(null)}>
                Keep
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(a)}
                aria-label={`Confirm delete announcement: ${a.title}`}
                className="inline-flex items-center justify-center gap-1.5 bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const pinned = sorted.filter(a => a.pinned);
  const regular = sorted.filter(a => !a.pinned);

  return (
    <div className="space-y-4">
      <div aria-live="polite">
        {status && (
          <p role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{status}</p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {canManage && !formOpen && (
        <button type="button" onClick={openNew} disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
          <MegaphoneIcon size={14} /> Post announcement
        </button>
      )}

      {formOpen && (
        <form key={editingId} onSubmit={submit} noValidate className="card p-5 space-y-3" aria-busy={busy}>
          <p className="text-sm font-semibold text-slate-900">
            {editingId === 'new' ? 'New announcement' : 'Edit announcement'}
          </p>
          <div>
            <label htmlFor="announcement-title" className="label-base">Announcement title</label>
            <input
              id="announcement-title"
              type="text"
              value={form.title}
              maxLength={200}
              disabled={busy}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-base"
            />
          </div>
          <div>
            <label htmlFor="announcement-body" className="label-base">Announcement body</label>
            <textarea
              id="announcement-body"
              value={form.body}
              rows={5}
              disabled={busy}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              className="input-base resize-y"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.pinned}
              disabled={busy}
              onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
            />
            Pin to top
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={cancel} disabled={busy} className="btn-secondary text-sm disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">
              {busy ? 'Saving…' : editingId === 'new' ? 'Post' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      {pinned.length > 0 && <div className="space-y-3">{pinned.map(renderCard)}</div>}

      {regular.length > 0 && (
        <div className="card divide-y divide-slate-100 overflow-hidden">{regular.map(renderCard)}</div>
      )}

      {sorted.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <BellIcon size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-slate-600">No announcements yet</p>
          {canManage && <p className="text-xs text-slate-400 mt-1">Post an announcement to keep participants informed.</p>}
        </div>
      )}
    </div>
  );
}
