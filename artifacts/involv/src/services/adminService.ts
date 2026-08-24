import { supabase } from '../lib/supabase';
import type { User, UserRole, Opportunity, Application } from '../types';
import type { Database } from '../lib/database.types';
import type { Category } from '../types';
import { rowToApplication } from './applicationService';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

function rowToUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
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

type OpportunityRow = Database['public']['Tables']['opportunities']['Row'];

function rowToOpportunity(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    organizerId: row.organizer_id ?? undefined,
    title: row.title,
    category: row.category as Opportunity['category'],
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    organizerName: row.organizer_name,
    organizerRole: row.organizer_role,
    organizerEmail: row.organizer_email,
    locationType: row.location_type as Opportunity['locationType'],
    locationText: row.location_text,
    dates: row.dates,
    timeCommitment: row.time_commitment,
    durationType: row.duration_type as Opportunity['durationType'],
    skillLevel: row.skill_level as Opportunity['skillLevel'],
    impactType: row.impact_type as Opportunity['impactType'],
    skillsRequired: row.skills_required,
    minGradeOrAge: row.min_grade_or_age,
    languageRequirements: row.language_requirements,
    positionsAvailable: row.positions_available,
    applicationDeadline: row.application_deadline,
    startDate: row.start_date ?? '',
    skillsGained: row.skills_gained,
    cvRelevance: row.cv_relevance,
    impactDescription: row.impact_description,
    tags: row.tags,
    featured: row.featured,
    applicantsCount: row.applicants_count,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Fetch all user profiles ordered by join date. */
export async function getAllProfiles(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToUser);
}

/** Fetch ALL opportunities (any status) — admin only. */
export async function getAllOpportunitiesAdmin(): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToOpportunity);
}

/** Fetch ALL applications across the platform — admin only. */
export async function getAllApplicationsAdmin(): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('submitted_date', { ascending: false });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map(row => rowToApplication(row as any));
}

/** Change a user's role. */
export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', uid);
  if (error) throw error;
}

/** Delete a user's profile (removes their Involv data; Supabase auth account remains). */
export async function deleteUserProfile(uid: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', uid);
  if (error) throw error;
}

/** Hard-delete an opportunity and all its applications (CASCADE). */
export async function deleteOpportunity(id: string): Promise<void> {
  const { error } = await supabase
    .from('opportunities')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/** Toggle the featured flag on an opportunity. */
export async function setOpportunityFeatured(id: string, featured: boolean): Promise<void> {
  const { error } = await supabase
    .from('opportunities')
    .update({ featured })
    .eq('id', id);
  if (error) throw error;
}

/** Set an opportunity's status — admin version. */
export async function adminSetOpportunityStatus(
  id: string,
  status: 'active' | 'draft' | 'closed' | 'archived',
): Promise<void> {
  const { error } = await supabase
    .from('opportunities')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}
