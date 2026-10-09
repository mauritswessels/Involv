import { supabase } from '../lib/supabase';
import { rowToOpportunity } from './opportunityService';
import type { Database } from '../lib/database.types';
import type { Announcement, OppSession, Opportunity } from '../types';

export interface ActivityHubData {
  opportunity: Opportunity;
  canManage: boolean;
  participants: { id: string; name: string }[];
  announcements: Announcement[];
  sessions: OppSession[];
}
export interface AnnouncementInput { title: string; body: string; pinned: boolean }
export interface SessionInput {
  title: string; date: string; startTime: string; endTime: string;
  location: string; notes: string;
}
type AnnouncementRow = Database['public']['Tables']['activity_announcements']['Row'];
type SessionRow = Database['public']['Tables']['activity_sessions']['Row'];
type HubResponse = {
  opportunity: Database['public']['Tables']['opportunities']['Row'];
  can_manage: boolean;
  participants: { id: string; name: string }[];
  announcements: AnnouncementRow[];
  sessions: SessionRow[];
};
function message(error: { code?: string; message?: string }): Error {
  if (error.code === '42501') return Object.assign(new Error('You do not have access. Only accepted participants, the approved activity owner and school admins can use this hub.'), { code: error.code });
  if (error.code === 'P0002' || error.code === 'PGRST116') return new Error('The record is unavailable or your access has changed. Refresh the hub and try again.');
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code ?? '')) return new Error('The Activity Hub database setup has not been activated yet. Ask the site administrator to apply the Activity Hub migration.');
  return new Error(error.message || 'Could not save changes. Please try again.');
}
export async function getActivityHub(opportunityId: string): Promise<ActivityHubData> {
  const { data, error } = await supabase.rpc('get_activity_hub', { target_opportunity_id: opportunityId });
  if (error) throw message(error);
  const hub = data as unknown as HubResponse;
  if (!hub?.opportunity || !Array.isArray(hub.participants) || !Array.isArray(hub.announcements) || !Array.isArray(hub.sessions)) {
    throw new Error('The Activity Hub returned an invalid response. Please contact the site administrator.');
  }
  return {
    opportunity: rowToOpportunity(hub.opportunity), canManage: hub.can_manage,
    participants: hub.participants,
    announcements: hub.announcements.map(a => ({
      id: a.id, opportunityId: a.opportunity_id, authorId: a.author_id ?? '',
      authorName: a.author_name, authorRole: a.author_role, title: a.title,
      body: a.body, pinned: a.pinned, createdAt: a.created_at,
    })),
    sessions: hub.sessions.map(s => ({
      id: s.id, opportunityId: s.opportunity_id, title: s.title, date: s.session_date,
      startTime: s.start_time.slice(0, 5), endTime: s.end_time.slice(0, 5),
      location: s.location, notes: s.notes,
    })),
  };
}
export async function saveAnnouncement(opportunityId: string, input: AnnouncementInput, id?: string): Promise<void> {
  const payload = { title: input.title.trim(), body: input.body.trim(), pinned: input.pinned };
  const query = id
    ? supabase.from('activity_announcements').update(payload).eq('opportunity_id', opportunityId).eq('id', id)
    : supabase.from('activity_announcements').insert({ ...payload, opportunity_id: opportunityId });
  const { error } = await query.select('id').single();
  if (error) throw message(error);
}
export async function setAnnouncementPinned(opportunityId: string, id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('activity_announcements').update({ pinned })
    .eq('opportunity_id', opportunityId).eq('id', id).select('id').single();
  if (error) throw message(error);
}
export async function deleteAnnouncement(opportunityId: string, id: string): Promise<void> {
  const { error } = await supabase.from('activity_announcements').delete()
    .eq('opportunity_id', opportunityId).eq('id', id).select('id').single();
  if (error) throw message(error);
}
export async function saveSession(opportunityId: string, input: SessionInput, id?: string): Promise<void> {
  const payload = {
    title: input.title.trim(), session_date: input.date, start_time: input.startTime,
    end_time: input.endTime, location: input.location.trim(), notes: input.notes.trim(),
  };
  const query = id
    ? supabase.from('activity_sessions').update(payload).eq('opportunity_id', opportunityId).eq('id', id)
    : supabase.from('activity_sessions').insert({ ...payload, opportunity_id: opportunityId });
  const { error } = await query.select('id').single();
  if (error) throw message(error);
}
export async function deleteSession(opportunityId: string, id: string): Promise<void> {
  const { error } = await supabase.from('activity_sessions').delete()
    .eq('opportunity_id', opportunityId).eq('id', id).select('id').single();
  if (error) throw message(error);
}
