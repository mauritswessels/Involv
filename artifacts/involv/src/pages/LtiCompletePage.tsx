import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DEMO_MODE, DEMO_PERSONAS, type DemoRole } from '../demo/demoMode';
import { startDemoAs } from '../demo/demoSession';

/** Only in-app paths, never another site. Mirrors safePath in api/_lib/lti.ts. */
function safeNext(path: string | null): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/api/') || path.startsWith('/lti/')) return '/dashboard';
  return /^\/[A-Za-z0-9/_\-?=&%.#]*$/.test(path) ? path : '/dashboard';
}

/**
 * Last step of opening Involv from Toddle: swaps the one-time sign-in token from
 * /api/lti/launch for a normal session, then continues to the requested page.
 */
export default function LtiCompletePage() {
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    // Remove the one-time token from the address bar and history straight away.
    window.history.replaceState(null, '', window.location.pathname);
    const next = safeNext(params.get('next'));
    const tokenHash = params.get('token_hash');
    const demo = params.get('demo') as DemoRole | null;

    (async () => {
      if (DEMO_MODE) {
        const role: DemoRole = demo && demo in DEMO_PERSONAS ? demo : 'student';
        await startDemoAs(role, false);
        window.location.replace(next === '/dashboard' ? DEMO_PERSONAS[role].startPath : next);
        return;
      }
      if (!tokenHash) {
        setError(demo
          ? 'Toddle sign-in is not fully set up on this site yet (the server is missing its Supabase service key).'
          : 'This sign-in link is incomplete. Please open Involv from Toddle again.');
        return;
      }
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
      if (verifyError) {
        setError('This sign-in link has expired or was already used. Please open Involv from Toddle again.');
        return;
      }
      window.location.replace(next);
    })().catch(() => setError('Something went wrong while signing you in. Please open Involv from Toddle again.'));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="card p-8 max-w-sm w-full text-center" role={error ? 'alert' : 'status'}>
        {error ? (
          <>
            <h1 className="text-base font-semibold text-slate-900 mb-2">Couldn't open Involv from Toddle</h1>
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <Link to="/" className="btn-secondary text-sm">Go to Involv</Link>
          </>
        ) : (
          <>
            <div className="w-6 h-6 mx-auto mb-3 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            <p className="text-sm text-slate-600">Signing you in from Toddle…</p>
          </>
        )}
      </div>
    </div>
  );
}
