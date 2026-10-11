import { useEffect, useRef, useState, type FormEvent } from 'react';
import { changeMessage, type ActivityMessage } from '../../services/messageService';

export default function MessageControls({ message, enabled, onChanged, onDenied }: {
  enabled: boolean;
  message: ActivityMessage; onChanged: (next: ActivityMessage) => void; onDenied: (e: unknown) => void;
}) {
  const [snapshot, setSnapshot] = useState<ActivityMessage | null>(null);
  const [action, setAction] = useState<'edit' | 'delete' | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const stale = !!snapshot && snapshot.updated_at !== message.updated_at;
  function open(next: 'edit' | 'delete') { setSnapshot(message); setAction(next); setText(message.content); setError(''); }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!snapshot || writing.current || stale || !enabled) return;
    if (action === 'edit' && (!text.trim() || text.trim().length > 2000)) { setError('Write 1–2000 characters.'); return; }
    writing.current = true; setBusy(true); setError('');
    try {
      const next = await changeMessage(snapshot, action === 'delete' ? null : text);
      if (mounted.current) { onChanged(next); setAction(null); setSnapshot(null); }
    } catch (e) {
      if (mounted.current) {
        if ((e as { code?: string })?.code === '42501') onDenied(e);
        else setError(e instanceof Error ? e.message : 'Could not confirm this change. Your draft is kept.');
      }
    } finally { writing.current = false; if (mounted.current) setBusy(false); }
  }
  if (!message.updated_at || message.deleted_at) return null;
  return <div className="mt-1 text-xs">
    {!action ? <div className="flex gap-3 text-slate-500">
      <button type="button" disabled={!enabled} onClick={() => open('edit')} aria-label="Edit your message" className="underline disabled:opacity-50">Edit</button>
      <button type="button" disabled={!enabled} onClick={() => open('delete')} aria-label="Delete your message" className="underline disabled:opacity-50">Delete</button>
    </div> : <form onSubmit={submit} className="mt-2 bg-white rounded-lg border border-slate-300 p-3 space-y-2 text-slate-800">
      {action === 'delete' ? <p>Delete this message’s text for everyone in this group? This cannot be undone. A “Message removed” marker will remain.</p>
        : <label className="block">Edit your message
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} rows={3} disabled={busy || !enabled}
            className="input-base mt-1 text-sm" required />
        </label>}
      {stale && <p role="alert" className="text-red-700">Message changed. Cancel and reopen it.</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || stale || !enabled} className="btn-primary text-xs disabled:opacity-50">{busy ? 'Saving…' : action === 'delete' ? 'Confirm delete' : 'Save edit'}</button>
        <button type="button" disabled={busy} onClick={() => { setAction(null); setSnapshot(null); }} className="btn-secondary text-xs">Cancel</button>
      </div>
    </form>}
  </div>;
}
