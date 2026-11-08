import { useState } from 'react';
import { RotateCcwIcon, SparklesIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DEMO_PERSONAS, personaById, type DemoRole } from '../../demo/demoMode';
import { resetDemo, startDemoAs } from '../../demo/demoSession';

/** Always-visible strip that says this is the demo, who you are, and lets you switch or reset. */
export default function DemoBanner() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const current = personaById(user?.id);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } catch { setBusy(false); }
  }

  return (
    <div role="region" aria-label="Demo mode" className="bg-amber-50 border-b border-amber-200 text-amber-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <SparklesIcon size={13} /> Demo
        </span>
        <span className="text-amber-900/80 hidden sm:inline">Sample data only — nothing you do is saved or sent anywhere.</span>
        <span className="flex items-center gap-1.5 ml-auto">
          {current && <span className="text-amber-900/80">Viewing as <strong className="text-amber-950">{current.label}</strong> ·</span>}
          <span className="text-amber-900/80">{current ? 'Switch to' : 'Try it as'}</span>
          {(Object.keys(DEMO_PERSONAS) as DemoRole[]).filter(r => r !== current?.role).map(role => (
            <button key={role} type="button" disabled={busy} onClick={() => void run(() => startDemoAs(role))}
              className="rounded-full border border-amber-300 bg-white px-2 py-0.5 font-medium hover:bg-amber-100 disabled:opacity-50">
              {DEMO_PERSONAS[role].label}
            </button>
          ))}
          <button type="button" disabled={busy} onClick={() => void run(resetDemo)} title="Undo every change and start again"
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium hover:bg-amber-100 disabled:opacity-50">
            <RotateCcwIcon size={11} /> Reset
          </button>
        </span>
      </div>
    </div>
  );
}
