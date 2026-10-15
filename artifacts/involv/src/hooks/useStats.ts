import { useState, useEffect } from 'react';
import { getSiteStats, type SiteStats } from '../services/statsService';

interface UseStatsResult {
  stats: SiteStats | null;
  loading: boolean;
  retry: () => void;
}

export function useStats(): UseStatsResult {
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSiteStats()
      .then(value => { if (active) setStats(value); })
      .catch(() => { if (active) setStats(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [version]);

  return { stats, loading, retry: () => setVersion(value => value + 1) };
}
