import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import type { AttendanceRecord, HoursEntry } from '../types';
import { readHourHistory, type HourReview } from './hourCorrectionService';

export interface ActivityAttendance extends AttendanceRecord {
  markedByName: string;
  updatedAt: string;
}
export interface ActivityHours extends HoursEntry {
  reviewHistory: HourReview[];
  updatedAt: string;
  reviewerName: string;
  reviewNote: string;
  reviewedAt: string | null;
}
export interface ParticipationData {
  canManage: boolean;
  canSubmit: boolean;
  attendance: ActivityAttendance[];
  hours: ActivityHours[];
}
export interface HoursInput { date: string; hours: number; description: string }
type ParticipationResponse = {
  can_manage: boolean; can_submit: boolean;
  attendance: Database['public']['Tables']['activity_attendance']['Row'][];
  hours: (Database['public']['Tables']['activity_hours']['Row'] & { review_history?: unknown })[];
};
function failure(error: { code?: string; message?: string }) {
  let text = error.message || 'Could not save the record. Please try again.';
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code ?? '')) {
    text = 'Attendance and service-hours setup is not activated yet. The site administrator needs to apply the participation migration.';
  } else if (error.code === '40001') {
    text = 'This record changed while you were viewing it. Refresh before editing or reviewing it.';
  }
  return Object.assign(new Error(text), { code: error.code });
}
export async function getParticipation(opportunityId: string): Promise<ParticipationData> {
  const { data, error } = await supabase.rpc('get_activity_participation', { target_opportunity_id: opportunityId });
  if (error) throw failure(error);
  const result = data as unknown as ParticipationResponse;
  if (!result || !Array.isArray(result.attendance) || !Array.isArray(result.hours)
    || typeof result.can_manage !== 'boolean' || typeof result.can_submit !== 'boolean') {
    throw new Error('Invalid participation response. Please contact the site administrator.');
  }
  return {
    canManage: result.can_manage, canSubmit: result.can_submit,
    attendance: result.attendance.map(a => ({
      id: a.id, opportunityId: a.opportunity_id, sessionId: a.session_id,
      studentId: a.student_id, studentName: a.student_name, present: a.present,
      markedByName: a.marked_by_name, updatedAt: a.updated_at,
    })),
    hours: result.hours.map(h => ({
      id: h.id, opportunityId: h.opportunity_id, studentId: h.student_id,
      studentName: h.student_name, date: h.service_date, hours: Number(h.hours),
      description: h.description, status: h.status, submittedAt: h.submitted_at,
      updatedAt: h.updated_at, reviewerName: h.reviewer_name,
      reviewNote: h.review_note, reviewedAt: h.reviewed_at,
      reviewHistory: readHourHistory(h.review_history),
    })),
  };
}
export async function markAttendance(sessionId: string, studentId: string, present: boolean | null): Promise<void> {
  const { error } = await supabase.rpc('mark_activity_attendance', {
    target_session_id: sessionId, target_student_id: studentId, marked_present: present,
  });
  if (error) throw failure(error);
}
export async function saveHours(opportunityId: string, input: HoursInput, existing?: ActivityHours): Promise<void> {
  const { error } = await supabase.rpc('save_activity_hours', {
    target_opportunity_id: opportunityId, service_day: input.date,
    claimed_hours: input.hours, entry_description: input.description.trim(),
    existing_entry_id: existing?.id ?? null, expected_updated_at: existing?.updatedAt ?? null,
  });
  if (error) throw failure(error);
}
export async function withdrawHours(entry: ActivityHours): Promise<void> {
  const { error } = await supabase.rpc('withdraw_activity_hours', {
    target_entry_id: entry.id, expected_updated_at: entry.updatedAt,
  });
  if (error) throw failure(error);
}
export async function reviewHours(entry: ActivityHours, decision: 'approved' | 'rejected', note: string): Promise<void> {
  const { error } = await supabase.rpc('review_activity_hours', {
    target_entry_id: entry.id, decision, reviewer_note: note.trim(),
    expected_updated_at: entry.updatedAt,
  });
  if (error) throw failure(error);
}
