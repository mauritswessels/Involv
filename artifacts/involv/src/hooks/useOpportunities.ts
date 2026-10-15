import { useState, useEffect } from 'react';
import type { Opportunity } from '../types';
import { getAllOpportunities } from '../services/opportunityService';
import { actionError } from '../utils/actionError';

interface UseOpportunitiesResult {
  opportunities: Opportunity[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Fetches active opportunities on mount, every 30 seconds and on focus/reconnect.
 * Works for both authenticated and unauthenticated users (RLS allows public reads).
 */
export function useOpportunities(): UseOpportunitiesResult {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true, fetching = false, refreshAgain = false;
    setLoading(true);
    const refresh = async () => {
      if (!active) return;
      if (fetching) { refreshAgain = true; return; }
      fetching = true;
      try {
        const rows = await getAllOpportunities();
        if (active) { setOpportunities(rows); setError(null); }
      } catch (err) { if (active) setError(actionError(err, 'load')); }
      finally {
        fetching = false;
        if (active) {
          setLoading(false);
          if (refreshAgain) { refreshAgain = false; void refresh(); }
        }
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    window.addEventListener('involv:applications-changed', refresh);
    return () => {
      active = false; clearInterval(timer);
      window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh);
      window.removeEventListener('involv:applications-changed', refresh);
    };
  }, [reloadKey]);

  return { opportunities, loading, error, retry: () => setReloadKey(v => v + 1) };
}
