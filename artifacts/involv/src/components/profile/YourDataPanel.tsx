import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { DownloadIcon, ShieldCheckIcon } from 'lucide-react';
import {
  downloadMyData, getMyPrivacyRequests, kindLabel, REQUEST_KINDS, STATUS_LABELS, submitPrivacyRequest,
  type PrivacyRequest, type PrivacyRequestKind,
} from '../../services/privacyService';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Profile → Your data: download everything, and send privacy requests to the school. */
export default function YourDataPanel() {
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [loadError, setLoadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [kind, setKind] = useState<PrivacyRequestKind | ''>('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    try { setRequests(await getMyPrivacyRequests()); setLoadError(''); }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not load your requests.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (window.location.hash === '#your-data') document.getElementById('your-data')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  async function download() {
    setDownloading(true); setDownloadError('');
    try { await downloadMyData(); }
    catch (e) { setDownloadError(e instanceof Error ? e.message : 'Could not prepare your download.'); }
    finally { setDownloading(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!kind) { setFormError('Choose what you would like.'); return; }
    if (kind === 'deletion' && !window.confirm('Send a request to delete your Involv account and records? The school will contact you before anything is deleted.')) return;
    setBusy(true); setFormError('');
    try {
      await submitPrivacyRequest(kind, details);
      setSent(true); setKind(''); setDetails(''); void load();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Could not send your request.'); }
    finally { setBusy(false); }
  }

  const hint = REQUEST_KINDS.find(k => k.value === kind)?.hint;
  return (
    <section id="your-data" className="card p-6 space-y-5 scroll-mt-24">
      <div className="flex items-start gap-3">
        <ShieldCheckIcon size={18} className="text-blue-900 mt-0.5" />
        <div>
          <h2 className="text-base font-semibold text-slate-900">Your data</h2>
          <p className="text-sm text-slate-500">
            See exactly what Involv stores about you, or ask the school to correct or delete it.{' '}
            <Link to="/privacy" className="text-blue-900 underline">How Involv uses your information</Link>
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <button type="button" onClick={() => void download()} disabled={downloading} className="btn-secondary text-sm disabled:opacity-50">
          <DownloadIcon size={14} /> {downloading ? 'Preparing…' : 'Download my data'}
        </button>
        <p className="text-xs text-slate-500">A file with your profile, applications, hours, reflections, messages you sent and notifications.</p>
        {downloadError && <p role="alert" className="text-xs text-red-700">{downloadError}</p>}
      </div>

      <form onSubmit={submit} className="space-y-2 border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-slate-800">Make a privacy request</p>
        <label className="block text-xs text-slate-600">What would you like?
          <select value={kind} onChange={e => { setKind(e.target.value as PrivacyRequestKind); setSent(false); }}
            className="input-base mt-1 text-sm" disabled={busy}>
            <option value="">Choose…</option>
            {REQUEST_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
        {kind && (
          <label className="block text-xs text-slate-600">Details{kind === 'correction' || kind === 'question' ? '' : ' (optional)'}
            <textarea value={details} onChange={e => setDetails(e.target.value)} maxLength={2000} rows={3}
              className="input-base mt-1 text-sm" disabled={busy}
              required={kind === 'correction' || kind === 'question'} />
          </label>
        )}
        {formError && <p role="alert" className="text-xs text-red-700">{formError}</p>}
        {sent && <p role="status" className="text-xs text-green-700">Request sent. You'll get a notification when the school replies.</p>}
        <button type="submit" disabled={busy || !kind} className="btn-primary text-sm disabled:opacity-50">{busy ? 'Sending…' : 'Send request'}</button>
      </form>

      {(requests.length > 0 || loadError) && (
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <p className="text-sm font-medium text-slate-800">Your requests</p>
          {loadError && <p role="alert" className="text-xs text-red-700">{loadError}</p>}
          <ul className="space-y-2">
            {requests.map(r => (
              <li key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">{kindLabel(r.kind)}</span>
                  <span className="text-xs text-slate-500">{STATUS_LABELS[r.status]} · {fmt(r.createdAt)}</span>
                </div>
                {r.response && <p className="mt-1 text-xs text-slate-600"><span className="font-semibold">{r.handlerName || 'School'}:</span> {r.response}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
