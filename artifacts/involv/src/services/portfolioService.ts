import { supabase } from '../lib/supabase';

export interface PortfolioEntry {
  id: string;
  opportunityId: string;
  activityTitle: string;
  activityCategory: string;
  activityStatus: string;
  date: string;
  hours: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  updatedAt: string;
  reviewerName: string;
  reviewNote: string;
  reviewedAt: string | null;
}
export interface ServicePortfolio {
  approvedHours: number;
  pendingHours: number;
  rejectedHours: number;
  approvedActivities: number;
  entries: PortfolioEntry[];
}
type Row = Record<string, unknown>;
function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid service portfolio response.');
  return value as Row;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid service portfolio response.');
  return value;
}
function number(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') {
    throw new Error('Invalid service portfolio response.');
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error('Invalid service portfolio response.');
  return n;
}
export async function getMyServicePortfolio(): Promise<ServicePortfolio> {
  const { data, error } = await supabase.rpc('get_my_service_portfolio', {});
  if (error) {
    const message = ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code)
      ? 'Service portfolio setup is not activated yet. The site administrator needs to apply the portfolio migration.'
      : error.code === '42501'
        ? 'Your service portfolio requires a verified school account. Access is currently unavailable.'
        : 'Could not load your service portfolio. Please try again.';
    throw Object.assign(new Error(message), { code: error.code });
  }
  const result = object(data);
  if (!Array.isArray(result.entries)) throw new Error('Invalid service portfolio response.');
  const entries = result.entries.map(value => {
    const row = object(value);
    const status = text(row.status);
    if (!['pending', 'approved', 'rejected'].includes(status)) throw new Error('Invalid service portfolio status.');
    const hours = number(row.hours);
    if (hours <= 0 || hours > 24) throw new Error('Invalid service portfolio hours.');
    return {
      id: text(row.id), opportunityId: text(row.opportunity_id),
      activityTitle: text(row.activity_title), activityCategory: text(row.activity_category),
      activityStatus: text(row.activity_status), date: text(row.service_date),
      hours, description: text(row.description), status: status as PortfolioEntry['status'],
      submittedAt: text(row.submitted_at), updatedAt: text(row.updated_at),
      reviewerName: text(row.reviewer_name), reviewNote: text(row.review_note),
      reviewedAt: row.reviewed_at === null ? null : text(row.reviewed_at),
    };
  });
  return {
    approvedHours: number(result.approved_hours),
    pendingHours: number(result.pending_hours),
    rejectedHours: number(result.rejected_hours),
    approvedActivities: number(result.approved_activities), entries,
  };
}
