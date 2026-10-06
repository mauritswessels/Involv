import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import type { User, UserRole, Category } from '../types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

function mapRowToUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    photoURL: row.photo_url ?? undefined,
    grade: row.grade ?? '',
    bio: row.bio ?? '',
    interests: row.interests ?? [],
    careerGoals: row.career_goals ?? [],
    skills: row.skills ?? [],
    availability: row.availability ?? [],
    preferredCategories: (row.preferred_categories ?? []) as Category[],
    onboardingComplete: row.onboarding_complete,
    createdAt: row.created_at,
  };
}

export async function getProfileById(uid: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRowToUser(data);
}

export async function createProfile(
  uid: string,
  payload: { name: string; email: string; photoUrl?: string },
): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: uid,
      name: payload.name,
      email: payload.email,
      photo_url: payload.photoUrl ?? null,
      role: 'student',
      bio: '',
      grade: '',
      interests: [],
      career_goals: [],
      skills: [],
      availability: [],
      preferred_categories: [],
      onboarding_complete: true,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRowToUser(data);
}

export async function updateProfile(uid: string, updates: Partial<User>): Promise<void> {
  // Map camelCase User fields → snake_case DB columns
  const dbUpdates: Database['public']['Tables']['profiles']['Update'] = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.photoURL !== undefined) dbUpdates.photo_url = updates.photoURL ?? null;
  if (updates.grade !== undefined) dbUpdates.grade = updates.grade;
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
  if (updates.interests !== undefined) dbUpdates.interests = updates.interests;
  if (updates.careerGoals !== undefined) dbUpdates.career_goals = updates.careerGoals;
  if (updates.skills !== undefined) dbUpdates.skills = updates.skills;
  if (updates.availability !== undefined) dbUpdates.availability = updates.availability;
  if (updates.preferredCategories !== undefined)
    dbUpdates.preferred_categories = updates.preferredCategories;

  const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', uid);
  if (error) throw error;
}
