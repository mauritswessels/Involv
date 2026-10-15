import { supabase } from '../lib/supabase';
import type { Application, ApplicationStatus } from '../types';
import type { Database } from '../lib/database.types';

type ApplicationRow = Database['public']['Tables']['applications']['Row'];

export function rowToApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    opportunityTitle: row.opportunity_title,
    applicantId: row.applicant_id,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    grade: row.grade,
    motivation: row.motivation,
    relevantExperience: row.relevant_experience,
    availability: row.availability,
    status: row.status,
    submittedDate: row.submitted_date,
  };
}

/** Fetch all applications submitted by a student. */
export async function getStudentApplications(applicantId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('applicant_id', applicantId)
    .order('submitted_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToApplication);
}

/** Fetch all applications for a specific opportunity (organizer view). */
export async function getOpportunityApplications(opportunityId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('submitted_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToApplication);
}

/** Submit a new application. Throws if the student has already applied (UNIQUE constraint). */
export async function createApplication(app: {
  opportunityId: string;
  opportunityTitle: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  organizerId: string | null;
  grade: string;
  motivation: string;
  relevantExperience: string;
  availability: string;
}): Promise<Application> {
  const { data, error } = await supabase
    .from('applications')
    .insert({
      opportunity_id: app.opportunityId,
      opportunity_title: app.opportunityTitle,
      applicant_id: app.applicantId,
      applicant_name: app.applicantName,
      applicant_email: app.applicantEmail,
      organizer_id: app.organizerId,
      grade: app.grade,
      motivation: app.motivation,
      relevant_experience: app.relevantExperience,
      availability: app.availability,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToApplication(data);
}

/** Update the status of an application (organizer action). */
export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
): Promise<void> {
  const { error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', applicationId)
    .select('id,status')
    .single();
  if (error) throw error;
}

/** Delete an application (student withdraw). */
export async function withdrawApplication(applicationId: string): Promise<void> {
  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('id', applicationId);
  if (error) throw error;
}
