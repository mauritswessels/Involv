import { supabase } from '../lib/supabase';

/**
 * Kicks off the Google OAuth redirect flow.
 * The browser navigates away to Google, then returns to /login
 * where onAuthStateChange picks up the session automatically.
 */
export async function signInWithGoogle(): Promise<void> {
  // Google rejects iframe navigation with a 403. Reserve a top-level tab
  // synchronously during the click so popup blockers do not reject it after
  // the asynchronous OAuth request.
  const embedded = window.self !== window.top;
  const loginTab = embedded ? window.open('about:blank', '_blank') : null;
  if (embedded && !loginTab) {
    throw new Error('Allow pop-ups for this site, or open Involv in a separate tab to sign in.');
  }
  if (loginTab) loginTab.opener = null;

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
        skipBrowserRedirect: embedded,
        // Google treats this as a hint, not an authorization check.
        queryParams: { hd: 'iszl.ch', prompt: 'select_account' },
      },
    });
    if (error) throw error;
    if (loginTab) {
      if (!data.url) throw new Error('Google sign-in did not return a login URL. Please try again.');
      loginTab.location.replace(data.url);
    }
  } catch (error) {
    loginTab?.close();
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
