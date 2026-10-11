import { supabase } from '../lib/supabase';

export interface ActivityMessage {
  id: string;
  opportunity_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
  updated_at?: string;
  edited_at?: string | null;
  deleted_at?: string | null;
}
function failure(error: { code?: string }): Error {
  let message = 'Could not connect to group messages. Your draft has been kept. Please retry.';
  if (error.code === '42501') message = 'Your access to this activity chat has ended.';
  if (['PGRST202', '42P01', '42883'].includes(error.code ?? '')) message = 'Group messaging is not activated yet. Ask the site administrator to apply the group-messaging migration.';
  if (error.code === '23514') message = 'The message or retry ID is invalid. Messages must contain 1–2000 characters.';
  if (error.code === 'P0001') message = 'You have sent too many messages. Wait a minute and retry.';
  if (error.code === '40001') message = 'This message changed or was removed. Cancel and reopen it before trying again.';
  return Object.assign(new Error(message), { code: error.code });
}
function parse(value: unknown): ActivityMessage {
  const row = value as ActivityMessage;
  if (!row || !['id', 'opportunity_id', 'sender_id', 'sender_name', 'sender_role', 'content', 'created_at']
    .every(key => typeof (row as unknown as Record<string, unknown>)[key] === 'string')) {
    throw new Error('Invalid message response. Please contact the site administrator.');
  }
  if ((row.updated_at !== undefined && typeof row.updated_at !== 'string')
    || [row.edited_at, row.deleted_at].some(v => v !== undefined && v !== null && typeof v !== 'string')) {
    throw new Error('Invalid message version response.');
  }
  return row;
}
export async function listMessages(opportunityId: string, cursor?: ActivityMessage, newer = false): Promise<ActivityMessage[]> {
  const { data, error } = await supabase.rpc('list_activity_messages', {
    target_opportunity_id: opportunityId, cursor_time: cursor?.created_at ?? null,
    cursor_id: cursor?.id ?? null, newer,
  });
  if (error) throw failure(error);
  if (!Array.isArray(data)) throw new Error('Invalid message history response.');
  return data.map(parse);
}
export async function sendMessage(opportunityId: string, content: string, nonce: string): Promise<ActivityMessage> {
  const { data, error } = await supabase.rpc('send_activity_message', {
    target_opportunity_id: opportunityId, message_content: content, request_nonce: nonce,
  });
  if (error) throw failure(error);
  return parse(data);
}
export async function messageUpdates(opportunityId: string, ids: string[]): Promise<ActivityMessage[]> {
  const { data, error } = await supabase.rpc('get_activity_message_updates', { target_opportunity_id: opportunityId, message_ids: ids });
  if (error) throw failure(error);
  if (!Array.isArray(data)) throw new Error('Invalid message update response.');
  return data.map(parse);
}
export async function changeMessage(message: ActivityMessage, content: string | null): Promise<ActivityMessage> {
  if (!message.updated_at) throw new Error('Message editing is not activated yet. Install the messaging upgrade first.');
  const { data, error } = await supabase.rpc('change_my_activity_message', {
    target_message_id: message.id, replacement_content: content?.trim() ?? null,
    expected_updated_at: message.updated_at, remove_message: content === null,
  });
  if (error) throw failure(error);
  return parse(data);
}
