import { supabase } from '../lib/supabase';
import { resetDemoData } from './demoBackend';
import { DEMO_PASSWORD, DEMO_PERSONAS, DEMO_STORAGE_KEY, type DemoRole } from './demoMode';

/** Sign in as one of the demo people, keeping everything done so far in this tab. */
export async function startDemoAs(role: DemoRole, redirect = true): Promise<void> {
  const persona = DEMO_PERSONAS[role];
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  const { error } = await supabase.auth.signInWithPassword({ email: persona.email, password: DEMO_PASSWORD });
  if (error) throw error;
  if (redirect) window.location.assign(persona.startPath);
}

/** Throw away every change made in this tab and go back to the start. */
export async function resetDemo(): Promise<void> {
  resetDemoData();
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  try { localStorage.removeItem(DEMO_STORAGE_KEY); } catch { /* ignore */ }
  window.location.assign('/');
}
