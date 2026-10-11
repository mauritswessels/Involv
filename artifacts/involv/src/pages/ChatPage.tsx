import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, SendIcon, UsersIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActivityHub, type ActivityHubData } from '../services/activityService';
import { listMessages, messageUpdates, sendMessage, type ActivityMessage } from '../services/messageService';
import { supabase } from '../lib/supabase';
import MessageControls from '../components/activity/MessageControls';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function merge(previous: ActivityMessage[], incoming: ActivityMessage[]) {
  const result = new Map(previous.map(m => [m.id, m]));
  const stamp = (m: ActivityMessage) => m.updated_at || m.created_at;
  const micros = (s: string) => (s.match(/\.(\d+)/)?.[1] || '').padEnd(6, '0');
  for (const m of incoming) {
    const old = result.get(m.id);
    if (!old || Date.parse(stamp(m)) > Date.parse(stamp(old))
      || (Date.parse(stamp(m)) === Date.parse(stamp(old)) && micros(stamp(m)) >= micros(stamp(old)))) result.set(m.id, m);
  }
  return [...result.values()]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
export default function ChatPage() {
  const { opportunityId = '' } = useParams();
  const { user } = useAuth();
  return <ActivityChat key={`${opportunityId}:${user?.id}:${user?.role}`} opportunityId={opportunityId} userId={user?.id ?? ''} />;
}

function ActivityChat({ opportunityId, userId }: { opportunityId: string; userId: string }) {
  const [hub, setHub] = useState<ActivityHubData | null>(null);
  const [messages, setMessages] = useState<ActivityMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [realtime, setRealtime] = useState(false);
  const known = useRef<ActivityMessage[]>([]);
  const liveChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mounted = useRef(false);
  const syncing = useRef(false);
  const refreshQueued = useRef(false);
  const sendBusy = useRef(false);
  const cursor = useRef<ActivityMessage | undefined>();
  const initialized = useRef(false);
  const retry = useRef<{ text: string; nonce: string } | null>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const denied = useRef(false);

  const report = useCallback((e: unknown) => {
    if (!mounted.current) return;
    setError(e instanceof Error ? e.message : 'Could not load chat. Please retry.');
    setReady(false);
    if ((e as { code?: string })?.code === '42501') {
      denied.current = true;
      setMessages([]); setHub(null); setInput(''); retry.current = null;
      known.current = []; setRealtime(false);
      if (liveChannel.current) { void supabase.removeChannel(liveChannel.current); liveChannel.current = null; }
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (denied.current) return;
    if (syncing.current) { refreshQueued.current = true; return; }
    syncing.current = true;
    try {
      if (!UUID.test(opportunityId)) throw new Error('Invalid activity link. Open chat from the Activity Hub.');
      const nextHub = await getActivityHub(opportunityId);
      // Refresh edits/tombstones for every loaded page, including older messages.
      const ids = known.current.filter(m => m.updated_at).map(m => m.id);
      for (let offset = 0; offset < ids.length; offset += 100) {
        const requested = ids.slice(offset, offset + 100);
        const changes = await messageUpdates(opportunityId, requested);
        if (!mounted.current || denied.current) return;
        const present = new Set(changes.map(m => m.id));
        const requestedSet = new Set(requested);
        setMessages(previous => merge(previous.filter(m => !requestedSet.has(m.id) || present.has(m.id)), changes));
      }
      // The sync cursor advances only from fetched history, never from a local send.
      // Otherwise a just-sent message could skip peers' earlier unseen messages.
      for (let page = 0; page < 5; page++) {
        const batch = await listMessages(opportunityId, cursor.current, initialized.current);
        if (!mounted.current || denied.current) return;
        setMessages(previous => merge(previous, batch));
        if (!initialized.current) setHasOlder(batch.length === 50);
        initialized.current = true;
        if (batch.length) cursor.current = batch[batch.length - 1];
        if (batch.length < 50) break;
      }
      if (mounted.current && !denied.current) { setHub(nextHub); setReady(true); setError(''); }
    } catch (e) { report(e); }
    finally {
      syncing.current = false;
      if (refreshQueued.current) {
        refreshQueued.current = false;
        queueMicrotask(() => { if (mounted.current && !denied.current) void refresh(); });
      }
    }
  }, [opportunityId, report]);

  useEffect(() => { known.current = messages; }, [messages]);
  useEffect(() => {
    if (!UUID.test(opportunityId) || !userId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const signal = () => {
      if (!active || denied.current) return;
      clearTimeout(timer);
      // Never display a raw event payload: reload through current-membership RPCs.
      timer = setTimeout(() => void refresh(), 150);
    };
    const channel = supabase.channel(`activity-messages:${opportunityId}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_messages', filter: `opportunity_id=eq.${opportunityId}` }, signal)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'activity_messages', filter: `opportunity_id=eq.${opportunityId}` }, signal)
      .subscribe(status => {
        if (!active || denied.current) return;
        setRealtime(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') signal();
      });
    liveChannel.current = channel;
    return () => {
      active = false; clearTimeout(timer); void supabase.removeChannel(channel);
      if (liveChannel.current === channel) liveChannel.current = null;
    };
  }, [opportunityId, userId, refresh]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const update = () => { if (!document.hidden) void refresh(); };
    const interval = window.setInterval(update, 5000);
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', update);
      window.removeEventListener('online', update);
    };
  }, [refresh]);

  useEffect(() => {
    const list = messageList.current;
    if (list && followBottom.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, sending]);

  async function loadOlder() {
    if (olderBusy || !messages.length) return;
    setOlderBusy(true);
    followBottom.current = false;
    const list = messageList.current;
    const height = list?.scrollHeight ?? 0;
    const position = list?.scrollTop ?? 0;
    try {
      const batch = await listMessages(opportunityId, messages[0]);
      if (mounted.current && !denied.current) {
        setMessages(previous => merge(previous, batch)); setHasOlder(batch.length === 50);
        requestAnimationFrame(() => {
          if (list) list.scrollTop = position + list.scrollHeight - height;
        });
      }
    } catch (e) { report(e); }
    finally { if (mounted.current) setOlderBusy(false); }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!ready || !text || text.length > 2000 || sendBusy.current || denied.current) return;
    if (retry.current?.text !== text) retry.current = { text, nonce: crypto.randomUUID() };
    sendBusy.current = true; setSending(true); setError('');
    try {
      const message = await sendMessage(opportunityId, text, retry.current.nonce);
      if (!mounted.current || denied.current) return;
      followBottom.current = true;
      setMessages(previous => merge(previous, [message]));
      setInput(''); retry.current = null;
      void refresh();
    } catch (e) {
      // A failed/uncertain write preserves both the draft and retry ID.
      if ((e as { code?: string })?.code === '42501') report(e);
      else if (mounted.current) setError(e instanceof Error ? e.message : 'Sending failed. Retry your draft.');
    } finally { sendBusy.current = false; if (mounted.current) setSending(false); }
  }

  return (
    <div className="h-[calc(100dvh-56px)] flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link to={`/activity/${opportunityId}`} aria-label="Back to Activity Hub" className="p-2 text-slate-500"><ArrowLeftIcon size={16} /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-slate-900 truncate">{hub?.opportunity.title ?? 'Activity group chat'}</h1>
          <p role="status" className="text-xs text-slate-500">{ready ? realtime ? 'Real-time connected · access checked every 5 seconds' : 'Polling connected · checks every 5 seconds' : error ? 'Not connected' : 'Connecting…'}</p>
        </div>
        <button aria-label="Toggle participant list" aria-expanded={showMembers} onClick={() => setShowMembers(v => !v)} className="p-2 text-blue-900"><UsersIcon size={18} /></button>
      </header>
      {error && <div role="alert" className="p-3 bg-red-50 text-red-800 text-sm">{error}
        {!denied.current && <button className="underline ml-2" onClick={() => void refresh()}>Retry connection</button>}
      </div>}
      <div className="flex flex-1 min-h-0 relative">
        <div className="flex-1 min-w-0 flex flex-col">
          <div ref={messageList} aria-label="Group messages"
            onScroll={e => { const list = e.currentTarget; followBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 100; }}
            className="flex-1 overflow-y-auto p-4 space-y-4">
            {hasOlder && <button disabled={olderBusy} onClick={() => void loadOlder()} className="btn-secondary text-xs">{olderBusy ? 'Loading…' : 'Load earlier messages'}</button>}
            {ready && !messages.length && <p className="text-center text-sm text-slate-500 py-8">No messages yet. Start the conversation.</p>}
            {messages.map(message => (
              <article key={message.id} className={`flex ${message.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] sm:max-w-[70%]">
                  <div className="text-xs text-slate-500 mb-1">
                    <span className="font-semibold">{message.sender_id === userId ? 'You' : message.sender_name}</span>
                    {message.sender_role !== 'student' && <span className="ml-2 capitalize">{message.sender_role}</span>}
                    <time className="ml-2" dateTime={message.created_at}>{new Date(message.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
                  </div>
                  <p className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${message.sender_id === userId ? 'bg-blue-900 text-white' : 'bg-white border border-slate-200 text-slate-900'}`}>{message.deleted_at ? 'Message removed' : message.content}</p>
                  {message.edited_at && !message.deleted_at && <p className="text-xs text-slate-500 mt-1">Edited {new Date(message.edited_at).toLocaleString('en-GB')}</p>}
                  {message.sender_id === userId && <MessageControls message={message} enabled={ready}
                    onChanged={next => { if (mounted.current && !denied.current) setMessages(previous => merge(previous, [next])); }}
                    onDenied={report} />}
                </div>
              </article>
            ))}
          </div>
          <form onSubmit={send} className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <textarea aria-label="Message" value={input} disabled={!ready || sending} maxLength={2000}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
                placeholder="Write a message…" rows={2}
                className="flex-1 min-w-0 border border-slate-200 rounded-xl p-2 text-sm resize-none disabled:opacity-50" />
              <button aria-label="Send message" disabled={!ready || sending || !input.trim()} className="p-3 bg-blue-900 text-white rounded-xl disabled:opacity-40"><SendIcon size={16} /></button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Shift+Enter for a new line · {input.length}/2000{sending && ' · Sending…'}</p>
          </form>
        </div>
        {showMembers && hub && <aside aria-label="Accepted participants" className="absolute right-0 inset-y-0 w-60 sm:static bg-white border-l border-slate-200 p-4 overflow-y-auto shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Accepted participants ({hub.participants.length})</h2>
          <p className="text-xs text-slate-500 mb-3">Approved activity managers and school admins also have chat access. Online status is not tracked.</p>
          <ul className="space-y-2 text-sm">{hub.participants.map(p => <li key={p.id}>{p.name}</li>)}</ul>
        </aside>}
      </div>
    </div>
  );
}
