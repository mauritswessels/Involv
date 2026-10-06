import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { signInWithGoogle as sbSignIn, signOutUser } from '../services/authService';
import { getProfileById, createProfile, updateProfile } from '../services/userService';
import { hasSchoolAccess, SCHOOL_ACCESS_MESSAGE } from '../lib/schoolAccess';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** True when the user has signed in with Google but has no profile yet */
  needsOnboarding: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pendingSession, setPendingSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Load profile for an authenticated Supabase session
  async function hydrateProfile(session: Session, isCurrent: () => boolean) {
    if (!hasSchoolAccess(session.user)) {
      if (!isCurrent()) return;
      setUser(null);
      setNeedsOnboarding(false);
      setPendingSession(null);
      setAuthError(SCHOOL_ACCESS_MESSAGE);
      await supabase.auth.signOut({ scope: 'local' });
      return;
    }
    try {
      const profile = await getProfileById(session.user.id);
      if (!isCurrent()) return;
      setAuthError(null);
      if (profile) {
        setUser(profile);
        setNeedsOnboarding(false);
        setPendingSession(null);
      } else {
        // New school members can create only a student profile.
        setPendingSession(session);
        setNeedsOnboarding(true);
        setUser(null);
      }
    } catch (err) {
      if (!isCurrent()) return;
      console.error('[Auth] profile loading failed');
      setAuthError('We could not load your school account. Please try signing in again.');
      setUser(null);
      setNeedsOnboarding(false);
      setPendingSession(null);
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let disposed = false;
    let revision = 0;
    let activeSession: Session | null = null;
    const refreshProfile = () => {
      if (!activeSession || disposed) return;
      const current = ++revision;
      void hydrateProfile(activeSession, () => !disposed && revision === current)
        .catch(() => {
          if (!disposed && revision === current) setAuthError('Could not sign out. Please close this tab and try again.');
        })
        .finally(() => {
          if (!disposed && revision === current) setLoading(false);
        });
    };
    // Do not await Supabase calls inside its auth callback: defer hydration
    // until the callback has released the auth client's session lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (activeSession?.user.id !== session?.user.id) {
          setUser(null);
          setPendingSession(null);
          setNeedsOnboarding(false);
        }
        activeSession = session;
        ++revision;
        if (session) {
          setTimeout(refreshProfile, 0);
        } else {
          setUser(null);
          setPendingSession(null);
          setNeedsOnboarding(false);
          setLoading(false);
        }
      },
    );
    // Pick up administrator-approved roles or revocations in an open tab.
    window.addEventListener('focus', refreshProfile);
    const interval = window.setInterval(refreshProfile, 60_000);
    return () => {
      disposed = true;
      ++revision;
      subscription.unsubscribe();
      window.removeEventListener('focus', refreshProfile);
      window.clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signInWithGoogle = async () => {
    setAuthError(null);
    await sbSignIn();
    // Browser navigates away to Google — onAuthStateChange handles the return
  };

  const completeOnboarding = async () => {
    if (!pendingSession || !hasSchoolAccess(pendingSession.user)) {
      throw new Error(SCHOOL_ACCESS_MESSAGE);
    }
    const { user: sbUser } = pendingSession;
    const newUser = await createProfile(sbUser.id, {
      name: sbUser.user_metadata?.full_name ?? sbUser.email ?? 'New User',
      email: sbUser.email ?? '',
      photoUrl: sbUser.user_metadata?.avatar_url,
    });
    setUser(newUser);
    setPendingSession(null);
    setNeedsOnboarding(false);
  };

  const logout = async () => {
    // Clear local state immediately so the UI responds before Supabase resolves
    setUser(null);
    setPendingSession(null);
    setNeedsOnboarding(false);
    await signOutUser();
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    if (updates.role !== undefined) throw new Error('Only an administrator can approve role changes.');
    await updateProfile(user.id, updates);
    setUser(prev => (prev ? { ...prev, ...updates } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        needsOnboarding,
        authError,
        signInWithGoogle,
        completeOnboarding,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
