import { useCallback, useEffect, useRef, useState } from 'react';
import { getManagedReflections, type ManagedReflection } from '../../services/reflectionService';

export default function ManagedReflectionsPanel({ opportunityId }: { opportunityId: string }) {
  const [entries, setEntries] = useState<ManagedReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const revision = useRef(0);
  const loadingRef = useRef(false);
  const load = useCallback(async (before?: ManagedReflection) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const attempt = ++revision.current;
    setLoading(true);
    try {
      const next = await getManagedReflections(opportunityId, before);
      if (attempt !== revision.current) return;
      setEntries(previous => before ? [...new Map([...previous, ...next].map(r => [r.id,r])).values()] : next);
      setHasMore(next.length === 50); setError('');
    } catch (e) {
      if (attempt !== revision.current) return;
      // Do not retain another person's text when permission cannot be confirmed.
      setEntries([]); setHasMore(false);
      setError(e instanceof Error ? e.message : 'Could not load activity reflections.');
    } finally {
      if (attempt === revision.current) { loadingRef.current = false; setLoading(false); }
    }
  }, [opportunityId]);
  useEffect(() => {
    loadingRef.current = false;
    void load();
    const update = () => { if (!document.hidden) void load(); };
    const timer = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    return () => { ++revision.current; window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, [load]);
  return <div className="space-y-4">
    <div className="card p-4 text-sm text-slate-600">Student reflections are visible only to their author, this activity’s approved owner and school admins. Your access is read-only; classmates and unrelated educators cannot read them.</div>
    <button className="btn-secondary text-xs" disabled={loading} onClick={() => void load()}>Refresh reflections</button>
    {loading && <p role="status" className="text-sm text-slate-500">Loading activity reflections…</p>}
    {error && <p role="alert" className="text-sm text-red-800 bg-red-50 rounded-lg p-3">{error}</p>}
    {!loading && !error && !entries.length && <div className="card p-8 text-center text-sm text-slate-600">No student reflections for this activity yet.</div>}
    {entries.map(entry => <article key={entry.id} className="card p-5 space-y-3">
      <div className="flex justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-900">{entry.author_name}</h2>
        <span className="text-xs text-slate-500">Saved {new Date(entry.created_at).toLocaleDateString('en-GB')}{entry.updated_at !== entry.created_at && ' · edited'}</span>
      </div>
      <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{entry.content}</p>
    </article>)}
    {hasMore && <button className="btn-secondary" disabled={loading} onClick={() => void load(entries[entries.length - 1])}>Load earlier reflections</button>}
  </div>;
}
