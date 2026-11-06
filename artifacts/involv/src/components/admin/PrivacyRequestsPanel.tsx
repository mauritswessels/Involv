import { useCallback, useEffect, useState } from 'react';
import { ShieldIcon } from 'lucide-react';
import {
  getPrivacyRequests, kindLabel, STATUS_LABELS, updatePrivacyRequest, type PrivacyRequest,
} from '../../services/privacyService';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function RequestCard({ request, onChanged }: { request: PrivacyRequest; onChanged: () => void }) {
  const [response, setResponse] = useState(request.response);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = request.status === 'open' || request.status === 'in_progress';
  async function set(status: 'in_progress' | 'completed' | 'declined') {
    setBusy(true); setError('');
    try { await updatePrivacyRequest(request.id, status, response); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); setBusy(false); }
  }
  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{kindLabel(request.kind)}</p>
          <p className="text-xs text-slate-500">{request.requesterName} · {request.requesterEmail} · {fmt(request.createdAt)}</p>
        </div>
        <span className="text-xs rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">{STATUS_LABELS[request.status]}</span>
      </div>
      {request.details && <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{request.details}</p>}
      {request.kind === 'deletion' && open && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Check the school's retention rules first. Deleting the user in Supabase (Authentication → Users) permanently removes their
          profile, applications, hours, reflections and messages. See docs/DATA_REQUESTS.md.
        </p>
      )}
      {open ? (
        <div className="space-y-2">
          <label className="block text-xs text-slate-600">Reply to the student (required to complete or decline)
            <textarea value={response} onChange={e => setResponse(e.target.value)} maxLength={2000} rows={2}
              className="input-base mt-1 text-xs" disabled={busy} />
          </label>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {request.status === 'open' && <button type="button" disabled={busy} onClick={() => void set('in_progress')} className="btn-secondary text-xs">Mark as being handled</button>}
            <button type="button" disabled={busy} onClick={() => void set('completed')} className="btn-primary text-xs disabled:opacity-50">Complete</button>
            <button type="button" disabled={busy} onClick={() => void set('declined')} className="btn-secondary text-xs">Decline</button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Answered by {request.handlerName}: {request.response}</p>
      )}
    </div>
  );
}

export default function PrivacyRequestsPanel({ onCountChange }: { onCountChange?: (open: number) => void }) {
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rows = await getPrivacyRequests(filter);
      setRequests(rows);
      if (filter === 'open') onCountChange?.(rows.length);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load requests.'); }
    finally { setLoading(false); }
  }, [filter, onCountChange]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(['open', 'closed'] as const).map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border ${filter === f ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-slate-600 border-slate-200'}`}>
            {f === 'open' ? 'Open' : 'Closed'}
          </button>
        ))}
        <button type="button" onClick={() => void load()} className="ml-auto text-xs text-blue-900 underline">Refresh</button>
      </div>
      {error && <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}
      {loading ? <p className="text-sm text-slate-500">Loading requests…</p>
        : requests.length === 0 ? (
          <div className="card p-8 text-center">
            <ShieldIcon size={20} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-600 mt-2">{filter === 'open' ? 'No open privacy requests.' : 'No closed requests yet.'}</p>
          </div>
        ) : requests.map(r => <RequestCard key={r.id} request={r} onChanged={() => void load()} />)}
    </div>
  );
}
