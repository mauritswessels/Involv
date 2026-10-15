import { useState, useEffect } from 'react';
import { actionError } from '../utils/actionError';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircleIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Step = 'signin' | 'setup';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, needsOnboarding, authError, signInWithGoogle, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  // Existing user — redirect to onboarding if first time student, else to dashboard
  useEffect(() => {
    if (user) {
      if (user.role === 'student' && !user.onboardingComplete) {
        navigate('/onboarding', { replace: true });
      } else {
        const dest = user.role === 'admin' ? '/admin' : user.role === 'student' ? '/dashboard' : '/organizer';
        navigate(dest, { replace: true });
      }
    }
  }, [user, navigate]);

  // New verified school member — create a student account, never self-select privileges.
  useEffect(() => {
    setStep(needsOnboarding ? 'setup' : 'signin');
    setLoading(false);
  }, [needsOnboarding]);

  // Supabase returns signup-hook denials via the OAuth callback URL.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (search.has('error') || hash.has('error')) {
      setError(actionError({ code: search.get('error') || hash.get('error') }, 'signin'));
      for (const key of ['error', 'error_description', 'error_code']) {
        search.delete(key);
        hash.delete(key);
      }
      window.history.replaceState(null, '', `${window.location.pathname}${search.size ? `?${search}` : ''}${hash.size ? `#${hash}` : ''}`);
    }
  }, []);
  const displayedError = error || authError;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // In an embedded preview, sign-in continues in a separate browser tab.
      setLoading(false);
    } catch (err) {
      setError(actionError(err, 'signin'));
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    setError(null);
    try {
      await completeOnboarding();
      // user effect above fires once profile is created and navigates
    } catch (err) {
      setError(actionError(err, 'account'));
      setLoading(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Minimal top bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.png" alt="Involv" className="h-7 w-auto" />
          </Link>
          <Link to="/browse" className="text-sm text-slate-600 hover:text-slate-900">
            Browse without signing in
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          {/* ── Step 1: Google sign-in ── */}
          {step === 'signin' && (
            <div className="card p-8">
              <div className="text-center mb-7">
                <h1 className="text-lg font-bold text-slate-900 mb-1">Sign in to Involv</h1>
                <p className="text-sm text-slate-600">
                  Use your ISZL Google account (@iszl.ch) to continue.
                </p>
              </div>

              {displayedError && (
                <div role="alert" className="mb-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertCircleIcon size={14} className="shrink-0" />
                  {displayedError}
                </div>
              )}

              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 border border-slate-200 bg-white rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                {/* Google G */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {loading ? 'Redirecting to Google…' : 'Continue with Google'}
              </button>

              <p className="text-xs text-slate-500 text-center mt-5 leading-relaxed">
                By signing in, you agree to use this platform for school-related service-learning
                activities only. Your school email is used for verification.
              </p>
            </div>
          )}

          {/* ── Step 2: Student account setup (new school members only) ── */}
          {step === 'setup' && (
            <div className="card p-8">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900 mb-1">Welcome to Involv</h2>
                <p className="text-sm text-slate-600">
                  Your ISZL account starts with student access.
                </p>
              </div>

              {displayedError && (
                <div role="alert" className="mb-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertCircleIcon size={14} className="shrink-0" />
                  {displayedError}
                </div>
              )}

              <p className="text-sm text-slate-600 mb-6">
                You can browse and apply for opportunities. If you are a teacher or
                student organiser, ask an Involv administrator to approve your role
                before you publish or manage opportunities.
              </p>

              <button
                onClick={handleContinue}
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5 disabled:opacity-60"
              >
                {loading ? 'Setting up your account…' : 'Create student account'}
              </button>
            </div>
          )}

          <p className="text-xs text-slate-500 text-center mt-5">
            No account needed — you sign in with your existing school Google account.
          </p>
        </div>
      </div>
    </div>
  );
}
