import { useState } from 'react';
import { GraduationCapIcon, PresentationIcon, ShieldCheckIcon, ArrowRightIcon } from 'lucide-react';
import { DEMO_PERSONAS, type DemoRole } from '../../demo/demoMode';
import { startDemoAs } from '../../demo/demoSession';

const ICONS: Record<DemoRole, React.ReactNode> = {
  student: <GraduationCapIcon size={18} />,
  teacher: <PresentationIcon size={18} />,
  admin: <ShieldCheckIcon size={18} />,
};

/** Three buttons that open the demo as a student, a teacher or a school admin. */
export default function DemoRolePicker({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<DemoRole | null>(null);
  const [error, setError] = useState('');
  async function open(role: DemoRole) {
    setBusy(role); setError('');
    try { await startDemoAs(role); }
    catch { setError('Could not open the demo. Please refresh and try again.'); setBusy(null); }
  }
  return (
    <div className="space-y-2.5">
      {(Object.keys(DEMO_PERSONAS) as DemoRole[]).map(role => {
        const p = DEMO_PERSONAS[role];
        return (
          <button key={role} type="button" onClick={() => void open(role)} disabled={busy !== null}
            className="w-full text-left flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-blue-900 hover:bg-blue-50/40 transition-colors disabled:opacity-60 group">
            <span className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center">{ICONS[role]}</span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                {busy === role ? 'Opening…' : `Explore as ${p.label.toLowerCase()}`}
                <ArrowRightIcon size={13} className="text-slate-400 group-hover:text-blue-900 transition-colors" />
              </span>
              {!compact && <span className="block text-xs text-slate-500 mt-0.5">{p.name} · {p.blurb}</span>}
            </span>
          </button>
        );
      })}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
