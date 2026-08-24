import { supabase } from '../lib/supabase';

/**
 * Kicks off the Google OAuth redirect flow.
 * The browser navigates away to Google, then returns to /login
 * where onAuthStateChange picks up the session automatically.
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/login`,
    },
  });
  if (error) throw error;
}

export async function signOutUser(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
