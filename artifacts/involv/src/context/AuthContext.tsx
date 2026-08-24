import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { signInWithGoogle as sbSignIn, signOutUser } from '../services/authService';
import { getProfileById, createProfile, updateProfile } from '../services/userService';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** True when the user has signed in with Google but has no profile yet */
  needsOnboarding: boolean;
  signInWithGoogle: () => Promise<void>;
  completeOnboarding: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pendingSession, setPendingSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Load profile for an authenticated Supabase session
  async function hydrateProfile(session: Session) {
    try {
      console.log('[Auth] hydrating profile for', session.user.email);
      const profile = await getProfileById(session.user.id);
      if (profile) {
        console.log('[Auth] profile found, role:', profile.role);
        setUser(profile);
        setNeedsOnboarding(false);
        setPendingSession(null);
      } else {
        console.log('[Auth] no profile found — showing role picker');
        // Signed in via Google but no profile row yet — show role picker
        setPendingSession(session);
        setNeedsOnboarding(true);
        setUser(null);
      }
    } catch (err) {
      console.error('[Auth] error loading profile:', err);
      setUser(null);
      setNeedsOnboarding(false);
      setPendingSession(null);
    }
  }

  useEffect(() => {
    // 1. Listen for auth state changes (covers page-load session restore + OAuth callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('[Auth] state change:', _event, session?.user?.email ?? 'no session');
        if (session) {
          await hydrateProfile(session);
        } else {
          setUser(null);
          setPendingSession(null);
          setNeedsOnboarding(false);
        }
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signInWithGoogle = async () => {
    await sbSignIn();
    // Browser navigates away to Google — onAuthStateChange handles the return
  };

  const completeOnboarding = async (role: UserRole) => {
    if (!pendingSession) return;
    const { user: sbUser } = pendingSession;
    const newUser = await createProfile(sbUser.id, {
      name: sbUser.user_metadata?.full_name ?? sbUser.email ?? 'New User',
      email: sbUser.email ?? '',
      photoUrl: sbUser.user_metadata?.avatar_url,
      role,
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
    // Optimistic update — UI responds instantly, Supabase persists in background
    setUser(prev => (prev ? { ...prev, ...updates } : prev));
    await updateProfile(user.id, updates);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        needsOnboarding,
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
