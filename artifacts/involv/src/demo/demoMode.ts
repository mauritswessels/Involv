/**
 * Demo mode: the whole site runs on sample data inside the visitor's browser.
 * Nothing is sent to Supabase and nothing is saved for anyone else.
 *
 * ONE switch controls it: the VITE_DEMO_MODE environment variable.
 *   - Vercel → Settings → Environment Variables → VITE_DEMO_MODE = true  → demo site
 *   - Delete that variable (or set it to false) and redeploy             → real site
 * See docs/DEMO_MODE.md.
 */
export const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE ?? '').trim().toLowerCase() === 'true';

/** Fake address used for the in-browser backend. No request ever leaves the browser. */
export const DEMO_SUPABASE_URL = 'https://demo.involv.local';
export const DEMO_ANON_KEY = 'demo-anon-key';
export const DEMO_STORAGE_KEY = 'involv-demo-session';
export const DEMO_DB_KEY = 'involv-demo-db-v1';

export type DemoRole = 'student' | 'teacher' | 'admin';

export interface DemoPersona {
  role: DemoRole;
  id: string;
  name: string;
  email: string;
  label: string;
  blurb: string;
  startPath: string;
}

export const DEMO_PERSONAS: Record<DemoRole, DemoPersona> = {
  student: {
    role: 'student', id: 'd0000000-0000-4000-8000-000000000001', name: 'Mia Keller',
    email: 'mia.keller.demo@iszl.ch', label: 'Student',
    blurb: 'Browse, apply, join an activity group, log hours and reflections.', startPath: '/dashboard',
  },
  teacher: {
    role: 'teacher', id: 'd0000000-0000-4000-8000-000000000002', name: 'Laura Rivera',
    email: 'laura.rivera.demo@iszl.ch', label: 'Teacher',
    blurb: 'Post opportunities, review applications, run sessions and approve hours.', startPath: '/organizer',
  },
  admin: {
    role: 'admin', id: 'd0000000-0000-4000-8000-000000000003', name: 'Daniel Brandt',
    email: 'daniel.brandt.demo@iszl.ch', label: 'School admin',
    blurb: 'Approve teachers, oversee every listing, handle reports and privacy requests.', startPath: '/admin',
  },
};

export const DEMO_PASSWORD = 'demo';

export function personaById(id: string | null | undefined): DemoPersona | null {
  return Object.values(DEMO_PERSONAS).find(p => p.id === id) ?? null;
}
