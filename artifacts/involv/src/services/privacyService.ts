import { supabase } from '../lib/supabase';

export type PrivacyRequestKind = 'access' | 'correction' | 'deletion' | 'question';
export type PrivacyRequestStatus = 'open' | 'in_progress' | 'completed' | 'declined';

export const REQUEST_KINDS: { value: PrivacyRequestKind; label: string; hint: string }[] = [
  { value: 'deletion', label: 'Delete my account and records', hint: 'The school decides what must be kept (for example approved service hours) and will tell you what happens.' },
  { value: 'correction', label: 'Correct something', hint: 'Tell us what is wrong and what it should say.' },
  { value: 'access', label: 'Ask for a copy of my information', hint: 'You can also download it yourself straight away with “Download my data”.' },
  { value: 'question', label: 'Ask a privacy question', hint: 'For example, who can see something.' },
];

export const STATUS_LABELS: Record<PrivacyRequestStatus, string> = {
  open: 'Received', in_progress: 'Being handled', completed: 'Completed', declined: 'Declined',
};

export interface PrivacyRequest {
  id: string;
  kind: PrivacyRequestKind;
  details: string;
  status: PrivacyRequestStatus;
  response: string;
  handlerName: string;
  createdAt: string;
  updatedAt: string;
  requesterName: string;
  requesterEmail: string;
}

function friendly(error: { code?: string; message?: string }): Error {
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code ?? '')) {
    return Object.assign(new Error('Privacy requests are not activated yet. Ask the site administrator to apply the privacy-requests migration.'), { code: error.code });
  }
  if (error.code === '42501') return Object.assign(new Error('A verified school account is required.'), { code: error.code });
  if (['23514', '23505', '54000', '40001', 'P0002'].includes(error.code ?? '') && error.message) {
    return Object.assign(new Error(error.message), { code: error.code });
  }
  return new Error('Something went wrong. Please try again.');
}

function parse(value: unknown): PrivacyRequest {
  const r = value as Record<string, unknown>;
  if (!r || typeof r.id !== 'string' || typeof r.kind !== 'string' || typeof r.status !== 'string') {
    throw new Error('Invalid privacy request response.');
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    id: r.id, kind: r.kind as PrivacyRequestKind, details: str(r.details), status: r.status as PrivacyRequestStatus,
    response: str(r.response), handlerName: str(r.handler_name), createdAt: str(r.created_at),
    updatedAt: str(r.updated_at), requesterName: str(r.requester_name), requesterEmail: str(r.requester_email),
  };
}

/** Downloads everything Involv stores about the signed-in user as a JSON file. */
export async function downloadMyData(): Promise<void> {
  const { data, error } = await supabase.rpc('export_my_data', {});
  if (error) throw friendly(error);
  if (!data || typeof data !== 'object') throw new Error('Invalid export response.');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `involv-my-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function submitPrivacyRequest(kind: PrivacyRequestKind, details: string): Promise<PrivacyRequest> {
  const { data, error } = await supabase.rpc('submit_privacy_request', { request_kind: kind, request_details: details.trim() });
  if (error) throw friendly(error);
  return parse(data);
}

export async function getMyPrivacyRequests(): Promise<PrivacyRequest[]> {
  const { data, error } = await supabase.rpc('get_my_privacy_requests', {});
  if (error) throw friendly(error);
  if (!Array.isArray(data)) throw new Error('Invalid privacy request response.');
  return data.map(parse);
}

export async function getPrivacyRequests(filter: 'open' | 'closed' | 'all' = 'open'): Promise<PrivacyRequest[]> {
  const { data, error } = await supabase.rpc('get_privacy_requests', { status_filter: filter });
  if (error) throw friendly(error);
  if (!Array.isArray(data)) throw new Error('Invalid privacy request response.');
  return data.map(parse);
}

export async function updatePrivacyRequest(id: string, status: Exclude<PrivacyRequestStatus, 'open'>, response: string): Promise<PrivacyRequest> {
  const { data, error } = await supabase.rpc('update_privacy_request', {
    target_request_id: id, new_status: status, admin_response: response.trim(),
  });
  if (error) throw friendly(error);
  return parse(data);
}

export const kindLabel = (kind: string) => REQUEST_KINDS.find(k => k.value === kind)?.label ?? kind;
