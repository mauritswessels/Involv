import { useState, useEffect } from 'react';
import { getSiteStats, type SiteStats } from '../services/statsService';

interface UseStatsResult {
  stats: SiteStats | null;
  loading: boolean;
}

export function useStats(): UseStatsResult {
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSiteStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}
