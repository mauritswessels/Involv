import { supabase } from '../lib/supabase';

export interface PrivateReflection {
  id: string; opportunity_id: string | null; activity_title: string;
  content: string; created_at: string; updated_at: string;
}
export interface ReflectionPage { entries: PrivateReflection[]; canCreate: boolean }
export function reflectionWordCount(content: string) {
  return content.trim().split(/\s+/).filter(Boolean).length;
}
function failure(error: { code?: string }): Error {
  let message = 'Could not connect to your reflections. Your draft has been kept; please retry.';
  if (error.code === '42501') message = 'You do not have permission to perform this reflection action. A verified school account is required; only accepted students can start new activity reflections.';
  if (error.code === '40001') message = 'This reflection changed or was removed in another tab. Your draft is kept. Refresh, then reopen the latest saved entry before editing or deleting it.';
  if (error.code === '23514') message = 'Write at least 30 words and no more than 10,000 characters.';
  if (['PGRST202', '42P01', '42883'].includes(error.code ?? '')) message = 'Reflections are not activated yet. Ask the site administrator to apply the reflection migrations in the activation guide.';
  return Object.assign(new Error(message), { code: error.code });
}
function parse(value: unknown): PrivateReflection {
  const entry = value as PrivateReflection;
  if (!entry || !['id','activity_title','content','created_at','updated_at']
    .every(key => typeof (entry as unknown as Record<string, unknown>)[key] === 'string')
    || !(entry.opportunity_id === null || typeof entry.opportunity_id === 'string')) {
    throw new Error('Invalid reflection response. Please contact the site administrator.');
  }
  return entry;
}
export async function getMyReflections(opportunityId?: string, before?: PrivateReflection): Promise<ReflectionPage> {
  const { data, error } = await supabase.rpc('get_my_activity_reflections', {
    target_opportunity_id: opportunityId ?? null,
    before_created_at: before?.created_at ?? null, before_id: before?.id ?? null,
  });
  if (error) throw failure(error);
  const result = data as { entries: unknown[]; can_create: boolean } | null;
  if (!result || !Array.isArray(result.entries) || typeof result.can_create !== 'boolean') {
    throw new Error('Invalid reflection history response.');
  }
  return { entries: result.entries.map(parse), canCreate: result.can_create };
}
export async function saveMyReflection(id: string, opportunityId: string | null, content: string, version: string | null) {
  const { data, error } = await supabase.rpc('save_my_activity_reflection', {
    target_reflection_id: id, target_opportunity_id: opportunityId,
    reflection_content: content.trim(), expected_updated_at: version,
  });
  if (error) throw failure(error);
  return parse(data);
}
export async function deleteMyReflection(entry: PrivateReflection) {
  const { error } = await supabase.rpc('delete_my_activity_reflection', {
    target_reflection_id: entry.id, expected_updated_at: entry.updated_at,
  });
  if (error) throw failure(error);
}

export interface ManagedReflection extends PrivateReflection { author_name: string }
export async function getManagedReflections(opportunityId: string, before?: ManagedReflection): Promise<ManagedReflection[]> {
  const { data, error } = await supabase.rpc('get_managed_activity_reflections', {
    target_opportunity_id: opportunityId,
    before_created_at: before?.created_at ?? null, before_id: before?.id ?? null,
  });
  if (error) {
    if (error.code === '42501') throw Object.assign(new Error('Reflection access is no longer available. Only the current approved activity owner and school admins can read student reflections.'), { code: error.code });
    throw failure(error);
  }
  if (!Array.isArray(data)) throw new Error('Invalid activity reflection response.');
  return data.map(value => {
    const entry = parse(value);
    if (typeof value.author_name !== 'string') throw new Error('Invalid reflection author response.');
    return { ...entry, author_name: value.author_name };
  });
}
