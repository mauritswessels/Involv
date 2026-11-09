import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, ClipboardCopyIcon, XIcon } from 'lucide-react';
import { getActivityHub } from '../../services/activityService';
import { getMyReflections, type PrivateReflection } from '../../services/reflectionService';
import type { PortfolioEntry } from '../../services/portfolioService';
import type { Opportunity } from '../../types';

/** The seven IB CAS learning outcomes, for the student to choose from. */
export const CAS_OUTCOMES = [
  'LO1 Identify own strengths and develop areas for growth',
  'LO2 Demonstrate that challenges have been undertaken, developing new skills in the process',
  'LO3 Demonstrate how to initiate and plan a CAS experience',
  'LO4 Show commitment to and perseverance in CAS experiences',
  'LO5 Demonstrate the skills and recognise the benefits of working collaboratively',
  'LO6 Demonstrate engagement with issues of global significance',
  'LO7 Recognise and consider the ethics of choices and actions',
];

const STRAND_HINTS: Record<string, string[]> = {
  'Arts, Culture & Media': ['Service', 'Creativity'],
  'Health & Wellbeing': ['Service', 'Activity'],
};

const fmtDay = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const hoursText = (n: number) => `${Number(n.toFixed(2))} ${n === 1 ? 'hour' : 'hours'}`;

/** Copies text, falling back to a hidden textarea where the Clipboard API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  try {
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch { return false; }
}

function CopyField({ label, value, hint, multiline = false }: { label: string; value: string; hint?: string; multiline?: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    setState((await copyText(value)) ? 'copied' : 'failed');
    setTimeout(() => setState('idle'), 2000);
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        <button type="button" onClick={() => void copy()} aria-label={`Copy ${label}`}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${state === 'copied' ? 'border-green-300 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-900 hover:text-blue-900'}`}>
          {state === 'copied' ? <><CheckIcon size={12} /> Copied</> : state === 'failed' ? 'Select and copy' : <><ClipboardCopyIcon size={12} /> Copy</>}
        </button>
      </div>
      <div className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 break-words select-all ${multiline ? 'whitespace-pre-wrap max-h-48 overflow-y-auto' : ''}`}>{value}</div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

interface Props {
  opportunityId: string;
  activityTitle: string;
  entries: PortfolioEntry[];
  onClose: () => void;
}

/**
 * Turns an activity's approved hours and reflections into ready-to-paste text for
 * Toddle → CAS → Create new. Only approved hours are included.
 */
export default function ToddleCasExport({ opportunityId, activityTitle, entries, onClose }: Props) {
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [reflections, setReflections] = useState<PrivateReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [allCopied, setAllCopied] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([getActivityHub(opportunityId), getMyReflections(opportunityId)]).then(([hub, refl]) => {
      if (!active) return;
      if (hub.status === 'fulfilled') setOpportunity(hub.value.opportunity);
      if (refl.status === 'fulfilled') setReflections(refl.value.entries);
      setLoading(false);
    });
    return () => { active = false; };
  }, [opportunityId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const approved = useMemo(() => entries.filter(e => e.status === 'approved')
    .sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const total = approved.reduce((sum, e) => sum + e.hours, 0);
  const first = approved[0]?.date ?? opportunity?.startDate ?? '';
  const last = approved[approved.length - 1]?.date ?? first;
  const strands = STRAND_HINTS[opportunity?.category ?? ''] ?? ['Service'];
  const supervisor = opportunity ? `${opportunity.organizerName}${opportunity.organizerRole ? ` (${opportunity.organizerRole})` : ''}` : '';

  const hoursLog = approved.map(e => `• ${fmtDay(e.date)}: ${hoursText(e.hours)}. ${e.description.trim()}`
    + (e.reviewerName ? ` (approved by ${e.reviewerName}${e.reviewedAt ? ` on ${fmtDay(e.reviewedAt)}` : ''})` : '')).join('\n');

  const description = [
    `I took part in ${activityTitle}${opportunity?.organizerName ? `, organised by ${opportunity.organizerName}` : ''}.`
      + (opportunity?.shortDescription ? ` ${opportunity.shortDescription.trim()}` : ''),
    approved.length ? `What I did:\n${approved.map(e => `• ${e.description.trim()}`).join('\n')}` : '',
    approved.length ? `In total I contributed ${hoursText(total)} of approved service${!first ? '' : first === last ? ` on ${fmtDay(first)}` : ` between ${fmtDay(first)} and ${fmtDay(last)}`}.` : '',
  ].filter(Boolean).join('\n\n');

  const evidence = `Service hours recorded and approved in Involv (ISZL):\n${hoursLog}\nTotal approved: ${hoursText(total)}`;

  const everything = [
    `Title: ${activityTitle}`,
    `CAS strand(s): ${strands.join(', ')}`,
    supervisor && `Supervisor: ${supervisor}`,
    first && `Dates: ${fmtDay(first)}${last && last !== first ? ` to ${fmtDay(last)}` : ''}`,
    `Duration: ${hoursText(total)}`,
    outcomes.length ? `Learning outcomes:\n${outcomes.map(o => `• ${o}`).join('\n')}` : '',
    `Description:\n${description}`,
    `Evidence:\n${evidence}`,
    ...reflections.map((r, i) => `${reflections.length > 1 ? `Reflection ${i + 1}` : 'Reflection'} (${fmtDay(r.created_at)}):\n${r.content.trim()}`),
  ].filter(Boolean).join('\n\n');

  async function copyAll() {
    if (await copyText(everything)) { setAllCopied(true); setTimeout(() => setAllCopied(false), 2000); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="toddle-export-title" onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="toddle-export-title" className="text-base font-semibold text-slate-900">Add to Toddle CAS</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              In Toddle, open <strong>CAS → Create new</strong>, then copy each part below into the matching box.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"><XIcon size={18} /></button>
        </div>

        {loading ? (
          <p role="status" className="px-5 py-8 text-sm text-slate-500">Preparing your CAS entry…</p>
        ) : (
          <div className="px-5 py-5 space-y-5">
            {approved.length === 0 && (
              <p role="status" className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                None of your hours for this activity are approved yet, so there's nothing to show as evidence. You can still copy the title and description.
              </p>
            )}
            <CopyField label="Title" value={activityTitle} />
            <div className="grid sm:grid-cols-2 gap-4">
              <CopyField label="CAS strand(s)" value={strands.join(', ')}
                hint={strands.length > 1 ? 'Suggested from the activity type. Keep only the strands that fit.' : 'Add Creativity or Activity too if they fit what you did.'} />
              {supervisor && <CopyField label="Supervisor" value={supervisor} hint="Choose this person as supervisor in Toddle." />}
              {first && <CopyField label="Start date" value={fmtDay(first)} />}
              {last && <CopyField label="End date" value={fmtDay(last)} />}
            </div>
            <CopyField label="Duration" value={`${hoursText(total)} (${approved.length} approved ${approved.length === 1 ? 'entry' : 'entries'})`} />
            <CopyField label="Description" value={description} multiline hint="Edit it in Toddle so it sounds like you, and add your goals." />
            {approved.length > 0 && <CopyField label="Evidence: approved hours log" value={evidence} multiline
              hint="Paste as a post or note in the Evidence section. It shows who approved each entry." />}

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-semibold text-slate-700">Learning outcomes</legend>
              <p className="text-xs text-slate-500">Tick the ones this experience really shows. You tag them in Toddle; ticked ones are added to “Copy everything”.</p>
              {CAS_OUTCOMES.map(o => (
                <label key={o} className="flex items-start gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="mt-1" checked={outcomes.includes(o)}
                    onChange={e => setOutcomes(prev => e.target.checked ? [...prev, o] : prev.filter(x => x !== o))} />
                  <span>{o}</span>
                </label>
              ))}
            </fieldset>

            {reflections.length > 0 ? reflections.map((r, i) => (
              <CopyField key={r.id} label={`Reflection${reflections.length > 1 ? ` ${i + 1}` : ''} (${fmtDay(r.created_at)})`} value={r.content.trim()} multiline
                hint={i === 0 ? 'Paste as a reflection post in Toddle and tag the learning outcomes it shows.' : undefined} />
            )) : (
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                You haven't written a reflection for this activity yet.{' '}
                <Link to={`/activity/${opportunityId}`} className="text-blue-900 underline">Write one in the activity</Link> and it will appear here.
              </p>
            )}
          </div>
        )}

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">Only approved hours are included.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">Done</button>
            <button type="button" onClick={() => void copyAll()} disabled={loading} className="btn-primary text-xs disabled:opacity-50">
              {allCopied ? <><CheckIcon size={13} /> Copied</> : <><ClipboardCopyIcon size={13} /> Copy everything</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
