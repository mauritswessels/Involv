import { useState, useEffect, useCallback } from 'react';
import type { Opportunity, Application, ApplicationStatus } from '../types';
import { getOrganizerOpportunities } from '../services/opportunityService';
import {
  getOpportunityApplications,
  updateApplicationStatus,
  rowToApplication,
} from '../services/applicationService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { actionError } from '../utils/actionError';

interface UseOrganizerDataResult {
  opportunities: Opportunity[];
  applications: Application[];
  loading: boolean;
  error: string | null;
  /** Whether the real-time channel is connected. */
  live: boolean;
  /** Re-fetch applications for a specific opportunity (e.g. after a status change). */
  refreshApplications: (opportunityId: string) => Promise<void>;
  /** Optimistic local-only status update (pair with updateApplicationStatus service call). */
  updateLocalStatus: (applicationId: string, status: ApplicationStatus) => void;
}

/**
 * Loads all opportunities owned by the current organizer and all
 * applications across those opportunities.
 * Also opens a Supabase real-time channel so new/updated/deleted
 * applications appear instantly without a page reload.
 */
export function useOrganizerData(): UseOrganizerDataResult {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  // Initial data fetch
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);

    getOrganizerOpportunities(user.id)
      .then(async opps => {
        setOpportunities(opps);
        const appArrays = await Promise.all(opps.map(o => getOpportunityApplications(o.id)));
        setApplications(appArrays.flat());
      })
      .catch(err => setError(actionError(err, 'load')))
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Real-time subscription — filtered to this organizer's applications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`organizer-applications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `organizer_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const app = rowToApplication(payload.new as any);
            setApplications(prev =>
              prev.some(a => a.id === app.id) ? prev : [app, ...prev],
            );
          } else if (payload.eventType === 'UPDATE') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const app = rowToApplication(payload.new as any);
            setApplications(prev =>
              prev.map(a => (a.id === app.id ? app : a)),
            );
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setApplications(prev => prev.filter(a => a.id !== id));
          }
        },
      )
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setLive(false);
    };
  }, [user?.id]);

  const refreshApplications = useCallback(async (opportunityId: string) => {
    const apps = await getOpportunityApplications(opportunityId);
    setApplications(prev => [
      ...prev.filter(a => a.opportunityId !== opportunityId),
      ...apps,
    ]);
  }, []);

  const updateLocalStatus = useCallback(
    (applicationId: string, status: ApplicationStatus) => {
      setApplications(prev =>
        prev.map(a => (a.id === applicationId ? { ...a, status } : a)),
      );
    },
    [],
  );

  return { opportunities, applications, loading, error, live, refreshApplications, updateLocalStatus };
}
