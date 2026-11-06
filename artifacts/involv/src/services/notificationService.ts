import { supabase } from '../lib/supabase';

export type NotificationKind =
  | 'application_received' | 'application_update' | 'announcement' | 'hours_reviewed'
  | 'deadline_reminder' | 'session_reminder' | 'report_update' | 'privacy_request_update';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  opportunityId: string | null;
  /** In-app path to open; empty when there is nothing to open. */
  link: string;
  read: boolean;
  createdAt: string;
}

const KINDS = new Set<NotificationKind>(['application_received', 'application_update', 'announcement',
  'hours_reviewed', 'deadline_reminder', 'session_reminder', 'report_update', 'privacy_request_update']);

function parse(row: Record<string, unknown>): AppNotification | null {
  if (typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.created_at !== 'string'
    || !KINDS.has(row.kind as NotificationKind)) return null;
  const link = typeof row.link === 'string' && row.link.startsWith('/') && !row.link.startsWith('//') ? row.link : '';
  return {
    id: row.id, kind: row.kind as NotificationKind, title: row.title,
    body: typeof row.body === 'string' ? row.body : '',
    opportunityId: typeof row.opportunity_id === 'string' ? row.opportunity_id : null,
    link, read: row.read_at !== null && row.read_at !== undefined, createdAt: row.created_at,
  };
}

/** Most recent notices for the signed-in user (RLS returns only their own). */
export async function getMyNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase.from('notifications')
    .select('id,kind,title,body,opportunity_id,link,read_at,created_at')
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(row => parse(row as Record<string, unknown>)).filter((n): n is AppNotification => n !== null);
}

/** Adds deadline/session reminders for the caller; safe to call repeatedly. */
export async function queueMyReminders(): Promise<void> {
  const { error } = await supabase.rpc('queue_my_reminders', {});
  if (error) throw error;
}

/** Marks the given notices read, or all of the caller's notices when ids is omitted. */
export async function markNotificationsRead(ids?: string[]): Promise<void> {
  const { error } = await supabase.rpc('mark_my_notifications_read', { notification_ids: ids ?? null });
  if (error) throw error;
}

/** Postgres error codes meaning "the notifications migration is not installed yet". */
export function isNotInstalled(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  return ['PGRST202', 'PGRST205', '42P01', '42883'].includes(code);
}
