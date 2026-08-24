import { useState, useEffect } from 'react';
import type { Opportunity } from '../types';
import { getAllOpportunities } from '../services/opportunityService';

interface UseOpportunitiesResult {
  opportunities: Opportunity[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches all active opportunities from Supabase once on mount.
 * Works for both authenticated and unauthenticated users (RLS allows public reads).
 */
export function useOpportunities(): UseOpportunitiesResult {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllOpportunities()
      .then(setOpportunities)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { opportunities, loading, error };
}
