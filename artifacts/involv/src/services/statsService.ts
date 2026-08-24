import { supabase } from '../lib/supabase';

export interface SiteStats {
  activeOpportunities: number;
  studentsEnrolled: number;
  applicationsSubmitted: number;
}

/**
 * Calls the get_site_stats() RPC (SECURITY DEFINER) so the public landing
 * page can read aggregate counts without an authenticated session.
 *
 * Requires migration: 20240528000005_site_stats_fn.sql
 * Apply with: supabase db push  (or paste into the Supabase SQL editor)
 *
 * Falls back gracefully if the function hasn't been deployed yet —
 * the landing page will show 0s instead of crashing.
 */
export async function getSiteStats(): Promise<SiteStats> {
  const { data, error } = await supabase.rpc('get_site_stats');

  if (error || !data) {
    // Function not deployed yet — fall back to a public-only count
    const { count } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    return {
      activeOpportunities: count ?? 0,
      studentsEnrolled: 0,
      applicationsSubmitted: 0,
    };
  }

  return {
    activeOpportunities: data.active_opportunities ?? 0,
    studentsEnrolled: data.students_enrolled ?? 0,
    applicationsSubmitted: data.applications_submitted ?? 0,
  };
}
