import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Application, ApplicationStatus } from '../types';
import { logSafeError } from '../utils/safeConsole';
import { useAuth } from './AuthContext';
import { getSavedOpportunityIds, saveOpportunity, unsaveOpportunity } from '../services/savedService';
import { getStudentApplications, createApplication, updateApplicationStatus as persistStatus, withdrawApplication as persistWithdraw } from '../services/applicationService';
import { incrementApplicantsCount } from '../services/opportunityService';
import { SavedState, type SavedSnapshot } from '../services/savedState';
import { actionError } from '../utils/actionError';

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
  isSaving: (id: string) => boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <ScopedAppProvider key={user?.id ?? 'signed-out'}>{children}</ScopedAppProvider>;
}

function ScopedAppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<SavedSnapshot>({ ids: new Set(), pending: new Set(), ready: false });
  const savedIds = saved.ids;
  const [actionFailure, setActionFailure] = useState<string | null>(null);
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(!!user);
  const appRevision = useRef(0);
  const appPending = useRef(0);
  const retryLoad = useRef<() => void>(() => {});
  const store = useRef<SavedState | null>(null);
  if (!store.current) store.current = new SavedState(
    (id, wasSaved) => wasSaved ? unsaveOpportunity(user!.id, id) : saveOpportunity(user!.id, id),
    setSaved, error => { logSafeError('[App] saved-list change failed', error); setActionFailure(actionError(error, 'save')); },
  );

  // Reload saved IDs and student applications whenever the logged-in user changes
  useEffect(() => {
    const savedStore = store.current!;
    savedStore.activate();
    if (!user) return () => savedStore.dispose();
    let active = true, fetching = false;
    const refresh = async () => {
      if (fetching || !active) return;
      fetching = true;
      const savedVersion = savedStore.revision, applicationVersion = appRevision.current;
      try {
        const [ids, apps] = await Promise.all([getSavedOpportunityIds(user.id), getStudentApplications(user.id)]);
        if (!active) return;
        savedStore.hydrate(ids, savedVersion);
        if (!appPending.current && applicationVersion === appRevision.current) setApplications(apps);
        setLoadFailure(null);
      } catch (error) {
        if (active) { logSafeError('[App] failed to load user data', error); setLoadFailure(actionError(error, 'load')); }
      } finally { fetching = false; if (active) setLoading(false); }
    };
    void refresh();
    retryLoad.current = () => void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => {
      active = false; savedStore.dispose(); clearInterval(timer);
      retryLoad.current = () => {};
      window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh);
    };
  }, [user?.id]);

  const appliedIds = new Set(applications.map(a => a.opportunityId));

  const toggleSave = (id: string) => {
    if (!user) return;
    setActionFailure(null);
    void store.current!.toggle(id);
  };

  // Persist application to Supabase then add to local state
  const submitApplication = async (application: SubmitApplicationPayload): Promise<void> => {
    appRevision.current++; appPending.current++;
    try {
      const newApp = await createApplication(application);
      setApplications(prev => [newApp, ...prev.filter(a => a.id !== newApp.id)]);
    } finally { appRevision.current++; appPending.current--; }
    // Increment count asynchronously — failure is non-critical
    incrementApplicantsCount(application.opportunityId).catch(err =>
      logSafeError('[App] applicant count increment failed', err),
    );
  };

  // Only show a status change after the server confirms a matching row.
  const updateApplicationStatus = (applicationId: string, status: ApplicationStatus) => {
    appRevision.current++; appPending.current++;
    persistStatus(applicationId, status)
      .then(() => setApplications(prev => prev.map(a => a.id === applicationId ? { ...a, status } : a)))
      .catch(err => { logSafeError('[App] updateApplicationStatus failed', err); setActionFailure(actionError(err, 'review')); })
      .finally(() => { appRevision.current++; appPending.current--; });
  };

  // Optimistic withdraw — removes from state immediately, rolls back on error
  const withdrawApplication = async (applicationId: string): Promise<void> => {
    appRevision.current++; appPending.current++;
    const removed = applications.find(a => a.id === applicationId);
    setApplications(prev => prev.filter(a => a.id !== applicationId));
    try {
      await persistWithdraw(applicationId);
    } catch (err) {
      logSafeError('[App] withdrawApplication failed', err);
      setActionFailure(actionError(err, 'withdraw'));
      if (removed) setApplications(prev => [removed, ...prev]);
      throw err;
    } finally { appRevision.current++; appPending.current--; }
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
        isSaving: id => !!user && (!saved.ready || saved.pending.has(id)),
      }}
    >
      {children}
      {(actionFailure || loadFailure) && <div role="alert" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-96 z-[60] rounded-lg border border-red-200 bg-white p-4 text-sm text-red-800 shadow-lg">
        <p>{actionFailure || loadFailure}</p>
        {loadFailure && <button type="button" onClick={() => retryLoad.current()} className="underline mt-2 mr-4">Retry refresh</button>}
        <button type="button" onClick={() => { setActionFailure(null); setLoadFailure(null); }} className="underline mt-2">Dismiss</button>
      </div>}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
