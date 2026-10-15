import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface SiteStats {
  activeOpportunities: number;
  acceptedApplications: number;
  applicationsSubmitted: number;
}

/**
 * Calls the get_site_stats() RPC (SECURITY DEFINER) so the public landing
 * page can read aggregate counts without an authenticated session.
 *
 * Requires migration: 20240528000005_site_stats_fn.sql
 * Apply with: supabase db push  (or paste into the Supabase SQL editor)
 *
 * Unavailable or invalid counts are errors, not fabricated zeroes.
 */
export async function getSiteStats(): Promise<SiteStats> {
  if (!isSupabaseConfigured) {
    throw new Error('Platform counts unavailable');
  }

  const { data, error } = await supabase.rpc('get_site_stats');

  if (error) throw error;
  if (!data || ![data.active_opportunities, data.students_enrolled, data.applications_submitted]
    .every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0))
    throw new Error('Platform counts unavailable');

  return {
    activeOpportunities: data.active_opportunities,
    // The legacy RPC name counts accepted application rows, not distinct users.
    acceptedApplications: data.students_enrolled,
    applicationsSubmitted: data.applications_submitted,
  };
}
