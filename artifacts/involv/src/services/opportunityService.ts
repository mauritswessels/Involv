import { supabase } from '../lib/supabase';
import type { Opportunity } from '../types';
import type { Database } from '../lib/database.types';
import { PUBLIC_OPPORTUNITY_FIELDS } from './opportunityFields';
import { opportunityImagePublicUrl } from './opportunityImageService';

type OpportunityRow = Omit<Database['public']['Tables']['opportunities']['Row'], 'organizer_email' | 'updated_at' | 'cv_relevance'>;

export function rowToOpportunity(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    organizerId: row.organizer_id ?? undefined,
    title: row.title,
    category: row.category as Opportunity['category'],
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    organizerName: row.organizer_name,
    organizerRole: row.organizer_role,
    organizerEmail: '',
    locationType: row.location_type as Opportunity['locationType'],
    locationText: row.location_text,
    dates: row.dates,
    timeCommitment: row.time_commitment,
    durationType: row.duration_type as Opportunity['durationType'],
    skillLevel: row.skill_level as Opportunity['skillLevel'],
    serviceType: row.impact_type as Opportunity['serviceType'],
    servicePrograms: (row.service_programs ?? []) as Opportunity['servicePrograms'],
    imagePath: row.image_path,
    imageUrl: opportunityImagePublicUrl(row.image_path),
    skillsRequired: row.skills_required,
    minGradeOrAge: row.min_grade_or_age,
    languageRequirements: row.language_requirements,
    positionsAvailable: row.positions_available,
    applicationDeadline: row.application_deadline,
    startDate: row.start_date ?? '',
    skillsGained: row.skills_gained,
    impactDescription: row.impact_description,
    tags: row.tags,
    featured: row.featured,
    applicantsCount: row.applicants_count,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Fetch all active opportunities (readable by anyone with the anon key). */
export async function getAllOpportunities(): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select(PUBLIC_OPPORTUNITY_FIELDS)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToOpportunity);
}

/** Fetch all opportunities owned by a specific organizer (any status). */
export async function getOrganizerOpportunities(organizerId: string): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select(PUBLIC_OPPORTUNITY_FIELDS)
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToOpportunity);
}

/** Insert a new opportunity row; returns the created Opportunity. */
export async function createOpportunity(
  organizerId: string,
  opp: {
    title: string;
    category: string;
    shortDescription: string;
    fullDescription: string;
    organizerName: string;
    organizerRole: string;
    organizerEmail: string;
    locationType: string;
    locationText: string;
    dates: string;
    timeCommitment: string;
    durationType: string;
    skillLevel: string;
    serviceType: string;
    servicePrograms: string[];
    imagePath?: string | null;
    skillsRequired: string[];
    minGradeOrAge: string;
    positionsAvailable: number;
    applicationDeadline: string;
    startDate: string;
    skillsGained: string[];
    impactDescription: string;
    tags: string[];
  },
): Promise<Opportunity> {
  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      organizer_id: organizerId,
      title: opp.title,
      category: opp.category,
      short_description: opp.shortDescription,
      full_description: opp.fullDescription,
      organizer_name: opp.organizerName,
      organizer_role: opp.organizerRole,
      organizer_email: opp.organizerEmail,
      location_type: opp.locationType,
      location_text: opp.locationText,
      dates: opp.dates,
      time_commitment: opp.timeCommitment,
      duration_type: opp.durationType,
      skill_level: opp.skillLevel,
      impact_type: opp.serviceType,
      service_programs: opp.servicePrograms,
      image_path: opp.imagePath ?? null,
      skills_required: opp.skillsRequired,
      min_grade_or_age: opp.minGradeOrAge,
      positions_available: opp.positionsAvailable,
      application_deadline: opp.applicationDeadline,
      start_date: opp.startDate || null,
      skills_gained: opp.skillsGained,
      impact_description: opp.impactDescription,
      tags: opp.tags,
    })
    .select(PUBLIC_OPPORTUNITY_FIELDS)
    .single();
  if (error) throw error;
  return rowToOpportunity(data);
}

/** Private management field. Never merge it into shared listing caches. */
export async function getOpportunityContact(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_opportunity_contact', { target_opportunity_id: id });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('The private organiser contact could not be loaded.');
  return data;
}

/** Update an existing opportunity's fields. */
export async function updateOpportunity(
  id: string,
  updates: {
    title?: string;
    category?: string;
    shortDescription?: string;
    fullDescription?: string;
    organizerName?: string;
    organizerRole?: string;
    organizerEmail?: string;
    locationType?: string;
    locationText?: string;
    dates?: string;
    timeCommitment?: string;
    durationType?: string;
    skillLevel?: string;
    serviceType?: string;
    servicePrograms?: string[];
    imagePath?: string | null;
    skillsRequired?: string[];
    minGradeOrAge?: string;
    positionsAvailable?: number;
    applicationDeadline?: string;
    startDate?: string;
    skillsGained?: string[];
    impactDescription?: string;
  },
): Promise<void> {
  const dbUpdates: Database['public']['Tables']['opportunities']['Update'] = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.shortDescription !== undefined) dbUpdates.short_description = updates.shortDescription;
  if (updates.fullDescription !== undefined) dbUpdates.full_description = updates.fullDescription;
  if (updates.organizerName !== undefined) dbUpdates.organizer_name = updates.organizerName;
  if (updates.organizerRole !== undefined) dbUpdates.organizer_role = updates.organizerRole;
  if (updates.organizerEmail !== undefined) dbUpdates.organizer_email = updates.organizerEmail;
  if (updates.locationType !== undefined) dbUpdates.location_type = updates.locationType;
  if (updates.locationText !== undefined) dbUpdates.location_text = updates.locationText;
  if (updates.dates !== undefined) dbUpdates.dates = updates.dates;
  if (updates.timeCommitment !== undefined) dbUpdates.time_commitment = updates.timeCommitment;
  if (updates.durationType !== undefined) dbUpdates.duration_type = updates.durationType;
  if (updates.skillLevel !== undefined) dbUpdates.skill_level = updates.skillLevel;
  if (updates.serviceType !== undefined) dbUpdates.impact_type = updates.serviceType;
  if (updates.servicePrograms !== undefined) dbUpdates.service_programs = updates.servicePrograms;
  if (updates.imagePath !== undefined) dbUpdates.image_path = updates.imagePath;
  if (updates.skillsRequired !== undefined) dbUpdates.skills_required = updates.skillsRequired;
  if (updates.minGradeOrAge !== undefined) dbUpdates.min_grade_or_age = updates.minGradeOrAge;
  if (updates.positionsAvailable !== undefined) dbUpdates.positions_available = updates.positionsAvailable;
  if (updates.applicationDeadline !== undefined) dbUpdates.application_deadline = updates.applicationDeadline;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate || null;
  if (updates.skillsGained !== undefined) dbUpdates.skills_gained = updates.skillsGained;
  if (updates.impactDescription !== undefined) dbUpdates.impact_description = updates.impactDescription;

  const { error } = await supabase.from('opportunities').update(dbUpdates).eq('id', id);
  if (error) throw error;
}
/** Set an opportunity's status (e.g. 'closed', 'active', 'draft'). */
export async function setOpportunityStatus(
  id: string,
  status: 'active' | 'draft' | 'closed' | 'archived',
): Promise<void> {
  const { error } = await supabase.from('opportunities').update({ status }).eq('id', id);
  if (error) throw error;
}
