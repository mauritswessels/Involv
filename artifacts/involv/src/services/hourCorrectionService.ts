import { supabase } from '../lib/supabase';

export interface ReviewState {
  hours: number; status: 'pending' | 'approved' | 'rejected';
  reviewer_name: string; reviewed_at: string | null;
}
export interface HourReview {
  id: string; kind: 'baseline' | 'review' | 'correction';
  actor_name: string; reason: string; recorded_at: string;
  before_state: ReviewState | null; after_state: ReviewState;
}
export function readHourHistory(value: unknown): HourReview[] {
  // Older installations have no history field; correction writes fail explicitly until installed.
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Invalid hour review history.');
  const state = (v: unknown): ReviewState => {
    const s = v as ReviewState;
    if (!s || !Number.isFinite(Number(s.hours)) || Number(s.hours) <= 0 || Number(s.hours) > 24
      || !['pending', 'approved', 'rejected'].includes(s.status)
      || typeof s.reviewer_name !== 'string'
      || (s.reviewed_at !== null && typeof s.reviewed_at !== 'string')) throw new Error('Invalid hour review history.');
    return { ...s, hours: Number(s.hours) };
  };
  return value.map(v => {
    const r = v as HourReview;
    if (!r || !['baseline', 'review', 'correction'].includes(r.kind)
      || typeof r.id !== 'string' || typeof r.actor_name !== 'string'
      || typeof r.reason !== 'string' || typeof r.recorded_at !== 'string') throw new Error('Invalid hour review history.');
    return { ...r, before_state: r.before_state === null ? null : state(r.before_state), after_state: state(r.after_state) };
  });
}
export async function correctHours(
  entry: { id: string; updatedAt: string }, hours: number,
  status: 'approved' | 'rejected', reason: string, correctionId: string,
): Promise<void> {
  const { error, data } = await supabase.rpc('correct_activity_hours', {
    target_entry_id: entry.id, corrected_hours: hours, corrected_status: status,
    correction_reason: reason.trim(), expected_updated_at: entry.updatedAt, correction_id: correctionId,
  });
  if (error) {
    const message = ['PGRST202', '42883', '42P01'].includes(error.code)
      ? 'Hour corrections are not activated yet. The site administrator must install the correction migration.'
      : error.code === '40001' ? 'This entry changed. Refresh and reopen the correction before saving.'
      : error.code === '42501' ? 'You can only correct another student’s hours in an activity you are authorised to manage.'
      : error.code === '23514' ? 'Change the hours or decision, give a reason, and keep approved plus pending hours within 24 per day.'
      : 'Could not confirm the correction. Your form is kept; retry the same correction or refresh to check its history.';
    throw Object.assign(new Error(message), { code: error.code });
  }
  if (data !== true) throw new Error('Could not confirm the correction. Refresh to check the entry’s history.');
}
