import { supabase } from '../lib/supabase';

export interface ActivityMessage {
  id: string;
  opportunity_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}
function failure(error: { code?: string }): Error {
  let message = 'Could not connect to group messages. Your draft has been kept. Please retry.';
  if (error.code === '42501') message = 'Your access to this activity chat has ended.';
  if (['PGRST202', '42P01', '42883'].includes(error.code ?? '')) message = 'Group messaging is not activated yet. Ask the site administrator to apply the group-messaging migration.';
  if (error.code === '23514') message = 'The message or retry ID is invalid. Messages must contain 1–2000 characters.';
  if (error.code === 'P0001') message = 'You have sent too many messages. Wait a minute and retry.';
  return Object.assign(new Error(message), { code: error.code });
}
function parse(value: unknown): ActivityMessage {
  const row = value as ActivityMessage;
  if (!row || !['id', 'opportunity_id', 'sender_id', 'sender_name', 'sender_role', 'content', 'created_at']
    .every(key => typeof (row as unknown as Record<string, unknown>)[key] === 'string')) {
    throw new Error('Invalid message response. Please contact the site administrator.');
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
