import { supabase } from '../lib/supabase';

/** Returns the list of opportunity IDs the user has saved. */
export async function getSavedOpportunityIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_opportunities')
    .select('opportunity_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map(r => r.opportunity_id);
}

/** Save an opportunity for a user (idempotent — silently ignores duplicates). */
export async function saveOpportunity(userId: string, opportunityId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_opportunities')
    .insert({ user_id: userId, opportunity_id: opportunityId });
  // Postgres unique constraint violation code = '23505' — treat as "already saved"
  if (error && error.code !== '23505') throw error;
}

/** Remove a saved opportunity for a user. */
export async function unsaveOpportunity(userId: string, opportunityId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_opportunities')
    .delete()
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId);
  if (error) throw error;
}
