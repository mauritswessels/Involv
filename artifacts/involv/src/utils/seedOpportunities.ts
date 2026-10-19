/**
 * Seed script — loads the 12 mock opportunities into your Supabase database.
 *
 * Usage (browser console while the app is running):
 *   await window.seedOpportunities()
 *
 * You only need to run this ONCE. After seeding, real data comes from Supabase.
 * The function is automatically exposed on window in development mode only.
 */

import { supabase } from '../lib/supabase';
import { mockOpportunities } from '../data/mockData';
import { logSafeError, logSafeInfo } from './safeConsole';

async function seedOpportunities(): Promise<void> {
  logSafeInfo('[Seed] Starting opportunity seed', mockOpportunities.length);

  const rows = mockOpportunities.map(o => ({
    // No organizer_id for seeded data — these are demo listings
    title: o.title,
    category: o.category,
    short_description: o.shortDescription,
    full_description: o.fullDescription,
    organizer_name: o.organizerName,
    organizer_role: o.organizerRole,
    organizer_email: o.organizerEmail,
    location_type: o.locationType,
    location_text: o.locationText,
    dates: o.dates,
    time_commitment: o.timeCommitment,
    duration_type: o.durationType,
    skill_level: o.skillLevel,
    impact_type: o.serviceType,
    service_programs: o.servicePrograms,
    skills_required: o.skillsRequired,
    min_grade_or_age: o.minGradeOrAge,
    language_requirements: o.languageRequirements,
    positions_available: o.positionsAvailable,
    application_deadline: o.applicationDeadline,
    start_date: o.startDate || null,
    skills_gained: o.skillsGained,
    impact_description: o.impactDescription,
    tags: o.tags,
    featured: o.featured,
    applicants_count: o.applicantsCount,
    status: 'active' as const,
    // created_at defaults to NOW() in the database
  }));

  const { data, error } = await supabase
    .from('opportunities')
    .insert(rows)
    .select('id, title');

  if (error) {
    logSafeError('[Seed] Opportunity seed failed', error);
    throw error;
  }

  logSafeInfo('[Seed] Opportunity seed completed', data?.length);
}

// Expose on window in dev mode for easy console access
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).seedOpportunities = seedOpportunities;
}

export { seedOpportunities };
