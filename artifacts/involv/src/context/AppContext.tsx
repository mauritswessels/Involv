import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Application, ApplicationStatus } from '../types';
import { logSafeError } from '../utils/safeConsole';
import { useAuth } from './AuthContext';
import { getSavedOpportunityIds, saveOpportunity, unsaveOpportunity } from '../services/savedService';
import { getStudentApplications, createApplication, updateApplicationStatus as persistStatus, withdrawApplication as persistWithdraw } from '../services/applicationService';
import { incrementApplicantsCount } from '../services/opportunityService';

interface SubmitApplicationPayload {
  opportunityId: string;
  opportunityTitle: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  /** organizer_id stored on the opportunity — used by Supabase RLS */
  organizerId: string | null;
  grade: string;
  motivation: string;
  relevantExperience: string;
  availability: string;
}

interface AppContextType {
  savedIds: Set<string>;
  appliedIds: Set<string>;
  applications: Application[];
  loading: boolean;
  toggleSave: (id: string) => void;
  submitApplication: (application: SubmitApplicationPayload) => Promise<void>;
  updateApplicationStatus: (applicationId: string, status: ApplicationStatus) => void;
  withdrawApplication: (applicationId: string) => Promise<void>;
  isSaved: (id: string) => boolean;
  isApplied: (id: string) => boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);

  // Reload saved IDs and student applications whenever the logged-in user changes
  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      setApplications([]);
      return;
    }

    setLoading(true);
    Promise.all([
      getSavedOpportunityIds(user.id),
      getStudentApplications(user.id),
    ])
      .then(([ids, apps]) => {
        setSavedIds(new Set(ids));
        setApplications(apps);
      })
      .catch(err => logSafeError('[App] failed to load user data', err))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const appliedIds = new Set(applications.map(a => a.opportunityId));

  // Optimistic save/unsave — rolls back on error
  const toggleSave = (id: string) => {
    if (!user) return;
    const wasSaved = savedIds.has(id);

    setSavedIds(prev => {
      const next = new Set(prev);
      wasSaved ? next.delete(id) : next.add(id);
      return next;
    });

    const rollback = () =>
      setSavedIds(prev => {
        const next = new Set(prev);
        wasSaved ? next.add(id) : next.delete(id);
        return next;
      });

    (wasSaved ? unsaveOpportunity(user.id, id) : saveOpportunity(user.id, id))
      .catch(err => {
        logSafeError('[App] toggleSave failed', err);
        rollback();
      });
  };

  // Persist application to Supabase then add to local state
  const submitApplication = async (application: SubmitApplicationPayload): Promise<void> => {
    const newApp = await createApplication(application);
    setApplications(prev => [newApp, ...prev]);
    // Increment count asynchronously — failure is non-critical
    incrementApplicantsCount(application.opportunityId).catch(err =>
      logSafeError('[App] applicant count increment failed', err),
    );
  };

  // Optimistic status update for organizers
  const updateApplicationStatus = (applicationId: string, status: ApplicationStatus) => {
    setApplications(prev =>
      prev.map(a => (a.id === applicationId ? { ...a, status } : a)),
    );
    persistStatus(applicationId, status).catch(err =>
      logSafeError('[App] updateApplicationStatus failed', err),
    );
  };

  // Optimistic withdraw — removes from state immediately, rolls back on error
  const withdrawApplication = async (applicationId: string): Promise<void> => {
    const removed = applications.find(a => a.id === applicationId);
    setApplications(prev => prev.filter(a => a.id !== applicationId));
    try {
      await persistWithdraw(applicationId);
    } catch (err) {
      logSafeError('[App] withdrawApplication failed', err);
      if (removed) setApplications(prev => [removed, ...prev]);
      throw err;
    }
  };

  const isSaved = (id: string) => savedIds.has(id);
  const isApplied = (id: string) => appliedIds.has(id);

  return (
    <AppContext.Provider
      value={{
        savedIds,
        appliedIds,
        applications,
        loading,
        toggleSave,
        submitApplication,
        updateApplicationStatus,
        withdrawApplication,
        isSaved,
        isApplied,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
