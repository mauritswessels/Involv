import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenIcon, LockIcon } from 'lucide-react';
import { deleteMyReflection, getMyReflections, reflectionWordCount, saveMyReflection, type PrivateReflection } from '../../services/reflectionService';

interface Props { opportunityId?: string }
interface Draft { id: string; content: string; snapshot: PrivateReflection | null }
export default function PrivateReflectionsPanel({ opportunityId }: Props) {
  const [entries, setEntries] = useState<PrivateReflection[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<PrivateReflection | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const mounted = useRef(false);
  const writing = useRef(false);
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const attempt = ++revision.current;
    setLoading(true);
    try {
      const next = await getMyReflections(opportunityId);
      if (mounted.current && attempt === revision.current) {
        setEntries(next.entries); setCanCreate(next.canCreate); setHasMore(next.entries.length === 50); setError('');
      }
    } catch (e) {
      if (mounted.current && attempt === revision.current) {
        setError(e instanceof Error ? e.message : 'Could not load your reflections.');
        if ((e as { code?: string })?.code === '42501') {
          setEntries([]); setCanCreate(false); setDraft(null); setDeleting(null);
        }
      }
    } finally { if (mounted.current && attempt === revision.current) setLoading(false); }
  }, [opportunityId]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    // Another tab can change your private notes; focus refreshes them without
    // overwriting an open draft. Mutation versions provide the final safeguard.
    const focus = () => { if (!writing.current) void refresh(); };
    window.addEventListener('focus', focus);
    return () => { mounted.current = false; ++revision.current; window.removeEventListener('focus', focus); };
  }, [refresh]);

  async function more() {
    if (writing.current || loading || !entries.length) return;
    setLoading(true);
    const attempt = ++revision.current;
    try {
      const next = await getMyReflections(opportunityId, entries[entries.length - 1]);
      if (mounted.current && attempt === revision.current) {
        setEntries(previous => [...new Map([...previous,...next.entries].map(r => [r.id,r])).values()]);
        setHasMore(next.entries.length === 50); setCanCreate(next.canCreate);
      }
    } catch (e) {
      if (mounted.current && attempt === revision.current) {
        setError(e instanceof Error ? e.message : 'Could not load earlier reflections.');
        if ((e as { code?: string })?.code === '42501') {
          setEntries([]); setCanCreate(false); setDraft(null); setDeleting(null);
        }
      }
    }
    finally { if (mounted.current && attempt === revision.current) setLoading(false); }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || writing.current || reflectionWordCount(draft.content) < 30 || draft.content.trim().length > 10000) return;
    writing.current = true; setBusy(true); setError(''); setStatus('');
    ++revision.current; setLoading(false);
    try {
      const saved = await saveMyReflection(draft.id, draft.snapshot ? draft.snapshot.opportunity_id : opportunityId ?? null, draft.content, draft.snapshot?.updated_at ?? null);
      if (mounted.current) {
        setEntries(previous => [saved, ...previous.filter(r => r.id !== saved.id)]
          .sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)));
        setDraft(null); setExpanded(saved.id); setStatus('Reflection saved privately.');
      }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not save. Your draft is kept.'); }
    finally { writing.current = false; if (mounted.current) setBusy(false); }
  }
  async function remove() {
    if (!deleting || writing.current) return;
    writing.current = true; setBusy(true); setError(''); setStatus('');
    ++revision.current; setLoading(false);
    try {
      await deleteMyReflection(deleting);
      if (mounted.current) { setEntries(previous => previous.filter(r => r.id !== deleting.id)); setDeleting(null); setStatus('Reflection deleted.'); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not delete. Your reflection has been kept.'); }
    finally { writing.current = false; if (mounted.current) setBusy(false); }
  }
  const words = reflectionWordCount(draft?.content ?? '');
  const stale = draft?.snapshot && entries.some(r => r.id === draft.id && r.updated_at !== draft.snapshot?.updated_at);

  return <div className="space-y-4">
    <div className="card p-4 text-sm text-slate-600 flex flex-wrap items-center gap-2">
      <LockIcon size={16} /><span>Only you can view these reflections in Involv. They are not shared with activity managers or the group.</span>
      {opportunityId && <Link to="/reflections" className="text-blue-900 underline">All my private reflections</Link>}
    </div>
    <div className="flex justify-between gap-2 flex-wrap">
      {canCreate && opportunityId && !draft && <button className="btn-secondary" disabled={busy || loading || !!deleting}
        onClick={() => { setDraft({id:crypto.randomUUID(),content:'',snapshot:null}); setError(''); setStatus(''); }}>
        <BookOpenIcon size={14} /> Write a reflection
      </button>}
      <button className="btn-secondary text-xs" disabled={busy || loading} onClick={() => void refresh()}>Refresh saved reflections</button>
    </div>
    {loading && <p role="status" className="text-sm text-slate-500">Loading your reflections…</p>}
    {error && <p role="alert" className="text-sm text-red-800 bg-red-50 rounded-lg p-3">{error}</p>}
    {status && <p role="status" className="text-sm text-green-800 bg-green-50 rounded-lg p-3">{status}</p>}
    {draft && <form onSubmit={save} className="card p-5 space-y-3">
      <h2 className="font-semibold text-slate-900">{draft.snapshot ? 'Edit private reflection' : 'New private reflection'}</h2>
      <p className="text-xs text-slate-500">Reflect on what you did, what you learnt and how it went. Minimum 30 words.</p>
      <label htmlFor="reflection-content" className="label-base">Your reflection</label>
      <textarea id="reflection-content" className="input-base resize-y" rows={7} value={draft.content} disabled={busy}
        maxLength={10000} onChange={e => setDraft({...draft,content:e.target.value})} />
      <p className="text-xs text-slate-500">{words} words · {draft.content.length}/10,000 characters</p>
      {stale && <p role="alert" className="text-sm text-amber-800">A newer version was saved in another tab. Your draft is kept. Cancel and reopen the saved entry to use its latest version.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
        <button className="btn-primary" disabled={busy || loading || !!stale || words < 30 || draft.content.trim().length > 10000}>{busy ? 'Saving…' : 'Save reflection'}</button>
      </div>
    </form>}
    {deleting && <div role="alertdialog" aria-labelledby="reflection-delete-title" aria-describedby="reflection-delete-warning" className="card p-5 space-y-3 border-red-200">
      <h2 id="reflection-delete-title" className="font-semibold">Delete this reflection?</h2>
      <p id="reflection-delete-warning" className="text-sm text-slate-600">This permanently removes your saved reflection. You cannot undo it. Attendance and service hours are not affected.</p>
      <div className="flex gap-2">
        <button disabled={busy} className="btn-secondary" onClick={() => setDeleting(null)}>Keep reflection</button>
        <button disabled={busy || loading} className="btn-primary bg-red-700" onClick={() => void remove()}>{busy ? 'Deleting…' : 'Delete permanently'}</button>
      </div>
    </div>}
    {!loading && !error && !entries.length && <div className="card p-8 text-center">
      <BookOpenIcon className="mx-auto text-slate-400 mb-3" size={28} />
      <h2 className="text-sm font-semibold text-slate-700">No private reflections yet</h2>
      <p className="text-xs text-slate-500 mt-2">{opportunityId && !canCreate ? 'Only accepted students can start reflections for this activity. Managers cannot view students’ reflections.' : 'Write a reflection from the Reflections tab of an activity you have joined.'}</p>
    </div>}
    {entries.map(entry => <article key={entry.id} className="card p-5 space-y-3">
      <div className="flex justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{entry.activity_title}</h2>
        <span className="text-xs text-slate-500">Saved {new Date(entry.created_at).toLocaleDateString('en-GB')}{entry.updated_at !== entry.created_at && ' · edited'}</span>
      </div>
      <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{expanded === entry.id ? entry.content : entry.content.slice(0,240)}{expanded !== entry.id && entry.content.length > 240 && '…'}</p>
      <div className="flex flex-wrap gap-3 text-xs">
        {entry.content.length > 240 && <button className="text-blue-900 underline" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>{expanded === entry.id ? 'Show less' : 'Read full reflection'}</button>}
        <button className="text-blue-900 underline" disabled={busy || loading || !!draft || !!deleting} onClick={() => { setDraft({id:entry.id,content:entry.content,snapshot:entry}); setError(''); setStatus(''); }}>Edit</button>
        <button className="text-red-700 underline" disabled={busy || loading || !!draft || !!deleting} onClick={() => { setDeleting(entry); setError(''); setStatus(''); }}>Delete</button>
      </div>
    </article>)}
    {hasMore && <button className="btn-secondary" disabled={loading || busy} onClick={() => void more()}>Load earlier reflections</button>}
  </div>;
}
