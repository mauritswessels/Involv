import { supabase } from '../lib/supabase';

export type ReportReason = 'bullying' | 'inappropriate' | 'personal_information' | 'spam' | 'safety' | 'other';
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'bullying', label: 'Bullying or unkind' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'personal_information', label: 'Shares personal information' },
  { value: 'safety', label: 'Someone may be unsafe' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];

export interface MessageReport {
  id: string;
  messageId: string | null;
  opportunityId: string | null;
  activityTitle: string;
  reporterName: string;
  senderName: string;
  messageSnapshot: string;
  messageSentAt: string;
  messageCurrentlyRemoved: boolean;
  reason: ReportReason;
  details: string;
  status: 'open' | 'dismissed' | 'actioned';
  resolutionNote: string;
  messageRemoved: boolean;
  resolverName: string;
  resolvedAt: string | null;
  createdAt: string;
}

function friendly(error: { code?: string; message?: string }): Error {
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code ?? '')) {
    return Object.assign(new Error('Message reporting is not activated yet. Ask the site administrator to apply the message-reports migration.'), { code: error.code });
  }
  if (error.code === '42501') return Object.assign(new Error('You no longer have access to do this.'), { code: error.code });
  if (['23514', '54000', '40001', 'P0002'].includes(error.code ?? '') && error.message) {
    return Object.assign(new Error(error.message), { code: error.code });
  }
  return new Error('Something went wrong. Please try again.');
}

/** Report a message in a group you belong to. Repeating a report is harmless. */
export async function reportMessage(messageId: string, reason: ReportReason, details: string): Promise<{ alreadyReported: boolean }> {
  const { data, error } = await supabase.rpc('report_activity_message', {
    target_message_id: messageId, report_reason: reason, report_details: details.trim(),
  });
  if (error) throw friendly(error);
  const result = data as { already_reported?: unknown } | null;
  if (!result || typeof result.already_reported !== 'boolean') throw new Error('Invalid report response.');
  return { alreadyReported: result.already_reported };
}

function parseReport(value: unknown): MessageReport {
  const r = value as Record<string, unknown>;
  if (!r || typeof r.id !== 'string' || typeof r.message_snapshot !== 'string' || typeof r.status !== 'string') {
    throw new Error('Invalid report response.');
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    id: r.id, messageId: typeof r.message_id === 'string' ? r.message_id : null,
    opportunityId: typeof r.opportunity_id === 'string' ? r.opportunity_id : null,
    activityTitle: str(r.activity_title), reporterName: str(r.reporter_name), senderName: str(r.sender_name),
    messageSnapshot: r.message_snapshot, messageSentAt: str(r.message_sent_at),
    messageCurrentlyRemoved: r.message_currently_removed === true, reason: r.reason as ReportReason,
    details: str(r.details), status: r.status as MessageReport['status'], resolutionNote: str(r.resolution_note),
    messageRemoved: r.message_removed === true, resolverName: str(r.resolver_name),
    resolvedAt: typeof r.resolved_at === 'string' ? r.resolved_at : null, createdAt: str(r.created_at),
  };
}

export async function getMessageReports(filter: 'open' | 'closed' | 'all' = 'open'): Promise<MessageReport[]> {
  const { data, error } = await supabase.rpc('get_message_reports', { status_filter: filter });
  if (error) throw friendly(error);
  if (!Array.isArray(data)) throw new Error('Invalid report list response.');
  return data.map(parseReport);
}

export async function resolveReport(reportId: string, resolution: 'dismissed' | 'actioned', note: string, removeMessage: boolean): Promise<void> {
  const { error } = await supabase.rpc('resolve_message_report', {
    target_report_id: reportId, resolution, note: note.trim(), remove_message: removeMessage,
  });
  if (error) throw friendly(error);
}

export const reasonLabel = (reason: string) => REPORT_REASONS.find(r => r.value === reason)?.label ?? reason;
