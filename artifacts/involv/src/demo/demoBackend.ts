/**
 * In-browser stand-in for Supabase, used only when DEMO_MODE is on.
 * It answers the same REST, RPC and Auth requests supabase-js makes, against
 * sample data kept in sessionStorage (per browser tab, reset on demand).
 * Permission checks mirror the real database closely enough for a realistic demo;
 * the real rules live in supabase/migrations and are tested separately.
 */
import { buildDemoDb, zurichDate, type DemoDb, type Row } from './demoData';
import { DEMO_ANON_KEY, DEMO_DB_KEY, DEMO_PASSWORD, DEMO_PERSONAS, DEMO_SUPABASE_URL, personaById } from './demoMode';

// ── State ───────────────────────────────────────────────────────────────────
let db: DemoDb | null = null;
function data(): DemoDb {
  if (db) return db;
  try {
    const saved = sessionStorage.getItem(DEMO_DB_KEY);
    if (saved) db = JSON.parse(saved) as DemoDb;
  } catch { /* storage unavailable: fall back to a fresh copy */ }
  if (!db) db = buildDemoDb();
  return db;
}
function persist() {
  try { sessionStorage.setItem(DEMO_DB_KEY, JSON.stringify(db)); } catch { /* demo keeps working in memory */ }
}
export function resetDemoData() {
  db = null;
  try { sessionStorage.removeItem(DEMO_DB_KEY); } catch { /* ignore */ }
}
const table = (name: string): Row[] => (data()[name] ??= []);

let lastStamp = 0;
function now(): string {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return new Date(lastStamp).toISOString();
}
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

class DemoError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
function fail(code: string, message: string, status = 400): never { throw new DemoError(status, code, message); }
const denied = (message = 'You do not have permission to do this.') => fail('42501', message, 403);

// ── People and permissions ─────────────────────────────────────────────────
const profileOf = (uid: string | null) => (uid ? table('profiles').find(p => p.id === uid) ?? null : null);
const roleOf = (uid: string | null) => str(profileOf(uid)?.role);
const isAdmin = (uid: string | null) => roleOf(uid) === 'admin';
const isTrusted = (uid: string | null) => ['teacher', 'organizer', 'admin'].includes(roleOf(uid));
const oppOf = (oppId: unknown) => table('opportunities').find(o => o.id === oppId) ?? null;
function canManage(oppId: unknown, uid: string | null): boolean {
  const opp = oppOf(oppId);
  if (!opp || !uid) return false;
  return isAdmin(uid) || (opp.organizer_id === uid && isTrusted(uid));
}
const isAccepted = (oppId: unknown, uid: string | null) => !!uid && table('applications')
  .some(a => a.opportunity_id === oppId && a.applicant_id === uid && a.status === 'Accepted');
const canRead = (oppId: unknown, uid: string | null) => canManage(oppId, uid) || isAccepted(oppId, uid);
const adminIds = () => table('profiles').filter(p => p.role === 'admin').map(p => str(p.id));
function requireMember(uid: string | null): string {
  if (!uid || !profileOf(uid)) denied('A verified school account is required');
  return uid as string;
}

function notify(userId: string | null | undefined, kind: string, title: string, body: string,
  oppId: string | null, link: string, dedupe: string | null = null): boolean {
  if (!userId) return false;
  const list = table('notifications');
  if (dedupe && list.some(n => n.user_id === userId && n.dedupe_key === dedupe)) return false;
  list.push({ id: uuid(), user_id: userId, kind, title: title.slice(0, 200), body: body.slice(0, 500),
    opportunity_id: oppId, link, dedupe_key: dedupe, read_at: null, created_at: now() });
  return true;
}

function recount(oppId: unknown) {
  const opp = oppOf(oppId);
  if (opp) opp.applicants_count = table('applications').filter(a => a.opportunity_id === oppId).length;
}

// ── PostgREST-style query engine ───────────────────────────────────────────
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function compare(a: unknown, b: string): number {
  const an = Number(a), bn = Number(b);
  if (a !== null && a !== '' && b !== '' && Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return str(a) < b ? -1 : str(a) > b ? 1 : 0;
}
function listArg(arg: string): string[] {
  return arg.replace(/^[({[]|[)}\]]$/g, '').split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
}
function matches(row: Row, col: string, raw: string): boolean {
  let expr = raw, negate = false;
  if (expr.startsWith('not.')) { negate = true; expr = expr.slice(4); }
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot), arg = expr.slice(dot + 1);
  const v = row[col];
  let ok: boolean;
  switch (op) {
    case 'eq': ok = v !== null && v !== undefined && str(v) === arg; break;
    case 'neq': ok = v !== null && v !== undefined && str(v) !== arg; break;
    case 'gt': ok = v != null && compare(v, arg) > 0; break;
    case 'gte': ok = v != null && compare(v, arg) >= 0; break;
    case 'lt': ok = v != null && compare(v, arg) < 0; break;
    case 'lte': ok = v != null && compare(v, arg) <= 0; break;
    case 'is': ok = arg === 'null' ? v == null : str(v) === arg; break;
    case 'in': ok = listArg(arg).includes(str(v)); break;
    case 'cs': ok = Array.isArray(v) && listArg(arg).every(x => (v as unknown[]).map(str).includes(x)); break;
    case 'like': case 'ilike': {
      const re = new RegExp(`^${arg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*')}$`, op === 'ilike' ? 'i' : '');
      ok = re.test(str(v)); break;
    }
    default: ok = true;
  }
  return negate ? !ok : ok;
}
function filterRows(rows: Row[], params: URLSearchParams): Row[] {
  const filters = [...params.entries()].filter(([k]) => !RESERVED.has(k));
  return rows.filter(r => filters.every(([k, v]) => matches(r, k, v)));
}
function orderRows(rows: Row[], order: string | null): Row[] {
  if (!order) return rows;
  const keys = order.split(',').map(part => { const [col, dir] = part.split('.'); return { col, desc: dir === 'desc' }; });
  return [...rows].sort((a, b) => {
    for (const { col, desc } of keys) {
      const c = compare(a[col], str(b[col]));
      if (c !== 0) return desc ? -c : c;
    }
    return 0;
  });
}
function project(row: Row, select: string | null): Row {
  if (!select || select.trim() === '*') return { ...row };
  const out: Row = {};
  select.split(',').map(s => s.trim()).filter(Boolean).forEach(col => { if (col in row) out[col] = row[col]; });
  return out;
}

/** Row-level visibility, mirroring the main RLS rules. */
function visible(tableName: string, row: Row, uid: string | null): boolean {
  switch (tableName) {
    case 'notifications': case 'saved_opportunities': return row.user_id === uid;
    case 'profiles': return isAdmin(uid) || row.id === uid;
    case 'opportunities': return row.status === 'active' || isAdmin(uid) || (!!uid && row.organizer_id === uid);
    case 'applications': return isAdmin(uid) || row.applicant_id === uid || canManage(row.opportunity_id, uid);
    case 'activity_announcements': case 'activity_sessions': return canRead(row.opportunity_id, uid);
    default: return false;
  }
}
const PRIVATE_COLUMNS: Record<string, string[]> = { opportunities: ['organizer_email'] };

const DEFAULTS: Record<string, () => Row> = {
  opportunities: () => ({ organizer_name: '', organizer_role: '', organizer_email: '', location_type: 'On-campus', location_text: '',
    dates: '', time_commitment: '', duration_type: 'One-time', skill_level: 'Beginner', impact_type: 'Direct', service_programs: [],
    skills_required: [], min_grade_or_age: '', language_requirements: [], positions_available: 1, start_date: null, skills_gained: [],
    cv_relevance: '', impact_description: '', tags: [], featured: false, applicants_count: 0, status: 'active', short_description: '',
    full_description: '' }),
  profiles: () => ({ photo_url: null, grade: null, bio: null, interests: [], career_goals: [], skills: [], availability: [],
    preferred_categories: [], onboarding_complete: false }),
};

function beforeInsert(tableName: string, row: Row, uid: string | null): Row {
  const me = requireMember(uid);
  const stampNow = now();
  const base: Row = { id: uuid(), ...(DEFAULTS[tableName]?.() ?? {}), ...row };
  switch (tableName) {
    case 'profiles':
      if (row.id !== me) denied();
      return { ...base, role: 'student', created_at: stampNow, updated_at: stampNow };
    case 'opportunities':
      if (!isTrusted(me)) denied('Only approved teachers and organisers can post opportunities.');
      return { ...base, organizer_id: isAdmin(me) && row.organizer_id === null ? null : me, applicants_count: 0,
        created_at: stampNow, updated_at: stampNow };
    case 'applications': {
      const opp = oppOf(row.opportunity_id);
      if (!opp || opp.status !== 'active') fail('23514', 'This opportunity is not accepting applications.');
      if (str(opp!.application_deadline) < zurichDate()) fail('23514', 'The application deadline has passed.');
      if (row.applicant_id !== me) denied();
      if (table('applications').some(a => a.opportunity_id === opp!.id && a.applicant_id === me)) {
        fail('23505', 'duplicate key value violates unique constraint "applications_opportunity_id_applicant_id_key"', 409);
      }
      const p = profileOf(me)!;
      return { ...base, applicant_name: p.name, applicant_email: p.email, grade: str(row.grade || p.grade),
        organizer_id: opp!.organizer_id, opportunity_title: opp!.title, status: 'Pending',
        submitted_date: stampNow, updated_at: stampNow };
    }
    case 'saved_opportunities':
      if (row.user_id !== me) denied();
      return { ...base, created_at: stampNow };
    case 'activity_announcements': {
      if (!canManage(row.opportunity_id, me)) denied();
      const p = profileOf(me)!;
      return { pinned: false, body: '', ...base, author_id: me, author_name: p.name, author_role: p.role, created_at: stampNow, updated_at: stampNow };
    }
    case 'activity_sessions':
      if (!canManage(row.opportunity_id, me)) denied();
      return { notes: '', location: '', ...base, created_by: me, created_at: stampNow, updated_at: stampNow };
    default: return denied();
  }
}

function afterInsert(tableName: string, row: Row) {
  if (tableName === 'applications') {
    recount(row.opportunity_id);
    const opp = oppOf(row.opportunity_id);
    const title = str(opp?.title || row.opportunity_title);
    const recipients = opp?.organizer_id ? [str(opp.organizer_id)] : adminIds();
    recipients.forEach(r => notify(r, 'application_received', `New application: ${title}`,
      'A student applied. Review it from your organiser dashboard.', str(row.opportunity_id), `/applications/${row.opportunity_id}`));
  }
  if (tableName === 'activity_announcements') {
    const opp = oppOf(row.opportunity_id);
    table('applications').filter(a => a.opportunity_id === row.opportunity_id && a.status === 'Accepted' && a.applicant_id !== row.author_id)
      .forEach(a => notify(str(a.applicant_id), 'announcement', `New announcement: ${str(opp?.title)}`, str(row.title),
        str(row.opportunity_id), `/activity/${row.opportunity_id}`));
  }
}

function canUpdate(tableName: string, row: Row, patch: Row, uid: string | null): boolean {
  switch (tableName) {
    case 'profiles':
      if ('role' in patch && patch.role !== row.role) return isAdmin(uid) && row.id !== uid;
      return row.id === uid || isAdmin(uid);
    case 'opportunities': return canManage(row.id, uid);
    case 'applications':
      if ('status' in patch) return canManage(row.opportunity_id, uid);
      return row.applicant_id === uid;
    case 'activity_announcements': case 'activity_sessions': return canManage(row.opportunity_id, uid);
    case 'saved_opportunities': return row.user_id === uid;
    default: return false;
  }
}

function afterUpdate(tableName: string, before: Row, after: Row) {
  if (tableName === 'applications' && before.status !== after.status && ['Under Review', 'Accepted', 'Rejected'].includes(str(after.status))) {
    const title = str(oppOf(after.opportunity_id)?.title || after.opportunity_title);
    const accepted = after.status === 'Accepted';
    notify(str(after.applicant_id), 'application_update',
      `${accepted ? 'Accepted: ' : after.status === 'Rejected' ? 'Application update: ' : 'Under review: '}${title}`,
      accepted ? 'You have a place. Open the activity hub for announcements and sessions.'
        : after.status === 'Rejected' ? 'Your application was not accepted this time.' : 'The organiser is reviewing your application.',
      str(after.opportunity_id), accepted ? `/activity/${after.opportunity_id}` : '/dashboard');
  }
}

function canDelete(tableName: string, row: Row, uid: string | null): boolean {
  switch (tableName) {
    case 'saved_opportunities': return row.user_id === uid;
    case 'applications': return (row.applicant_id === uid && ['Pending', 'Under Review'].includes(str(row.status))) || isAdmin(uid);
    case 'opportunities': return isAdmin(uid) || canManage(row.id, uid);
    case 'profiles': return isAdmin(uid) && row.id !== uid;
    case 'activity_announcements': case 'activity_sessions': return canManage(row.opportunity_id, uid);
    default: return false;
  }
}

function afterDelete(tableName: string, row: Row) {
  const d = data();
  if (tableName === 'applications') recount(row.opportunity_id);
  if (tableName === 'opportunities') {
    for (const t of ['applications', 'saved_opportunities', 'activity_sessions', 'activity_announcements', 'activity_attendance',
      'activity_hours', 'activity_messages', 'notifications']) {
      d[t] = table(t).filter(r => r.opportunity_id !== row.id);
    }
  }
  if (tableName === 'profiles') {
    for (const [t, col] of [['applications', 'applicant_id'], ['saved_opportunities', 'user_id'], ['notifications', 'user_id'],
      ['activity_hours', 'student_id'], ['activity_attendance', 'student_id'], ['activity_reflections', 'student_id'],
      ['activity_messages', 'sender_id']] as const) {
      d[t] = table(t).filter(r => r[col] !== row.id);
    }
  }
  if (tableName === 'activity_sessions') d.activity_attendance = table('activity_attendance').filter(a => a.session_id !== row.id);
}

function handleRest(method: string, tableName: string, params: URLSearchParams, headers: Headers, body: unknown, uid: string | null) {
  const prefer = headers.get('prefer') ?? '';
  const wantsObject = (headers.get('accept') ?? '').includes('vnd.pgrst.object');
  const select = params.get('select');
  const strip = (r: Row) => {
    const out = project(r, select);
    if (!select || select === '*') (PRIVATE_COLUMNS[tableName] ?? []).forEach(c => { if (!canManage(r.id, uid)) delete out[c]; });
    return out;
  };
  let rows: Row[];
  let status = 200;

  if (method === 'GET' || method === 'HEAD') {
    rows = filterRows(table(tableName).filter(r => visible(tableName, r, uid)), params);
    rows = orderRows(rows, params.get('order'));
    const offset = Number(params.get('offset') ?? 0), limit = params.get('limit');
    rows = rows.slice(offset, limit ? offset + Number(limit) : undefined);
  } else if (method === 'POST') {
    const incoming = (Array.isArray(body) ? body : [body]) as Row[];
    const conflict = params.get('on_conflict')?.split(',').map(s => s.trim());
    rows = [];
    for (const raw of incoming) {
      if (conflict && prefer.includes('resolution=')) {
        const existing = table(tableName).find(r => conflict.every(c => r[c] === raw[c]));
        if (existing) {
          if (prefer.includes('merge-duplicates')) Object.assign(existing, raw, { updated_at: now() });
          continue;
        }
      }
      const row = beforeInsert(tableName, raw, uid);
      table(tableName).push(row);
      afterInsert(tableName, row);
      rows.push(row);
    }
    status = 201;
  } else if (method === 'PATCH') {
    const patch = (body ?? {}) as Row;
    const targets = filterRows(table(tableName).filter(r => visible(tableName, r, uid)), params);
    rows = [];
    for (const row of targets) {
      if (!canUpdate(tableName, row, patch, uid)) denied();
      const before = { ...row };
      Object.assign(row, patch);
      if ('updated_at' in row) row.updated_at = now();
      afterUpdate(tableName, before, row);
      rows.push(row);
    }
  } else if (method === 'DELETE') {
    const targets = filterRows(table(tableName).filter(r => visible(tableName, r, uid)), params);
    targets.forEach(r => { if (!canDelete(tableName, r, uid)) denied(); });
    data()[tableName] = table(tableName).filter(r => !targets.includes(r));
    targets.forEach(r => afterDelete(tableName, r));
    rows = targets;
  } else {
    return fail('PGRST100', 'Unsupported request');
  }
  if (method !== 'GET' && method !== 'HEAD') persist();

  const returning = method === 'GET' || method === 'HEAD' || prefer.includes('return=representation');
  if (!returning) return { status: method === 'POST' ? 201 : 204, body: null, count: rows.length };
  const out = rows.map(strip);
  if (wantsObject) {
    if (out.length !== 1) return { status: 406, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned',
      details: `The result contains ${out.length} rows`, hint: null }, count: out.length };
    return { status: status === 201 ? 201 : 200, body: out[0], count: 1 };
  }
  return { status, body: out, count: out.length };
}

// ── RPC functions ──────────────────────────────────────────────────────────
type Args = Record<string, unknown>;
const hoursOf = (oppId: unknown) => table('activity_hours').filter(h => h.opportunity_id === oppId);
const historyOf = (entryId: unknown) => table('activity_hour_reviews').filter(r => r.entry_id === entryId)
  .sort((a, b) => compare(a.recorded_at, str(b.recorded_at)))
  .map(r => ({ id: r.id, kind: r.kind, actor_name: r.actor_name, reason: r.reason, recorded_at: r.recorded_at,
    before_state: r.before_state, after_state: r.after_state }));
const hourState = (h: Row) => ({ hours: h.hours, status: h.status, reviewer_name: h.reviewer_name, reviewed_at: h.reviewed_at });
function recordHistory(entry: Row, kind: string, actor: string, reason: string, before: Row | null) {
  table('activity_hour_reviews').push({ id: uuid(), entry_id: entry.id, kind, actor_name: actor, reason,
    before_state: before, after_state: hourState(entry), recorded_at: now() });
}
const noNonce = (m: Row) => { const { client_nonce: _n, ...rest } = m; void _n; return rest; };
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
function versionCheck(row: Row, expected: unknown) {
  if (expected != null && str(expected) !== str(row.updated_at)) fail('40001', 'This record changed. Refresh and try again.', 409);
}
function publicOpportunity(o: Row): Row { const { organizer_email: _e, ...rest } = o; void _e; return rest; }

const RPC: Record<string, (args: Args, uid: string | null) => unknown> = {
  get_site_stats: () => ({
    active_opportunities: table('opportunities').filter(o => o.status === 'active').length,
    students_enrolled: table('applications').filter(a => a.status === 'Accepted').length,
    applications_submitted: table('applications').length,
  }),

  get_opportunity_contact: (a, uid) => {
    if (!canManage(a.target_opportunity_id, uid)) denied();
    return str(oppOf(a.target_opportunity_id)?.organizer_email) || null;
  },

  get_activity_hub: (a, uid) => {
    const oppId = a.target_opportunity_id;
    if (!canRead(oppId, uid)) denied('Only accepted members and the organiser can open this activity.');
    return {
      opportunity: publicOpportunity(oppOf(oppId)!),
      can_manage: canManage(oppId, uid),
      participants: table('applications').filter(x => x.opportunity_id === oppId && x.status === 'Accepted')
        .map(x => ({ id: x.applicant_id, name: x.applicant_name })),
      announcements: orderRows(table('activity_announcements').filter(x => x.opportunity_id === oppId), 'pinned.desc,created_at.desc'),
      sessions: orderRows(table('activity_sessions').filter(x => x.opportunity_id === oppId), 'session_date.asc,start_time.asc'),
    };
  },

  get_activity_participation: (a, uid) => {
    const oppId = a.target_opportunity_id;
    if (!canRead(oppId, uid)) denied();
    const manage = canManage(oppId, uid);
    return {
      can_manage: manage, can_submit: isAccepted(oppId, uid),
      attendance: table('activity_attendance').filter(x => x.opportunity_id === oppId && (manage || x.student_id === uid)),
      hours: orderRows(hoursOf(oppId).filter(h => manage || h.student_id === uid), 'service_date.desc')
        .map(h => ({ ...h, review_history: historyOf(h.id) })),
    };
  },

  mark_activity_attendance: (a, uid) => {
    const session = table('activity_sessions').find(s => s.id === a.target_session_id);
    if (!session || !canManage(session.opportunity_id, uid)) denied();
    if (!isAccepted(session!.opportunity_id, str(a.target_student_id))) fail('23514', 'Only accepted students can be marked.');
    const list = table('activity_attendance');
    const existing = list.find(x => x.session_id === session!.id && x.student_id === a.target_student_id);
    if (a.marked_present === null) { data().activity_attendance = list.filter(x => x !== existing); return null; }
    const student = profileOf(str(a.target_student_id));
    const row = existing ?? { id: uuid(), opportunity_id: session!.opportunity_id, session_id: session!.id,
      student_id: a.target_student_id, student_name: student?.name ?? 'Student' };
    Object.assign(row, { present: !!a.marked_present, marked_by: uid, marked_by_name: profileOf(uid)?.name, updated_at: now() });
    if (!existing) list.push(row);
    return null;
  },

  save_activity_hours: (a, uid) => {
    const oppId = a.target_opportunity_id;
    if (!isAccepted(oppId, uid)) denied('Only accepted students can log hours for this activity.');
    const hours = Number(a.claimed_hours), desc = str(a.entry_description).trim(), day = str(a.service_day);
    if (!(hours > 0 && hours <= 24)) fail('23514', 'Hours must be more than 0 and at most 24.');
    if (!desc) fail('23514', 'Describe what you did.');
    if (day > zurichDate()) fail('23514', 'You cannot log hours for a future date.');
    if (a.existing_entry_id) {
      const entry = table('activity_hours').find(h => h.id === a.existing_entry_id && h.student_id === uid);
      if (!entry || entry.status !== 'pending') fail('40001', 'Only pending entries can be edited.', 409);
      versionCheck(entry!, a.expected_updated_at);
      Object.assign(entry!, { hours, description: desc, service_date: day, updated_at: now() });
      return entry!.id;
    }
    const stampNow = now();
    const entry: Row = { id: uuid(), opportunity_id: oppId, student_id: uid, student_name: profileOf(uid)?.name, service_date: day,
      hours, description: desc, status: 'pending', submitted_at: stampNow, updated_at: stampNow, reviewed_by: null,
      reviewer_name: '', review_note: '', reviewed_at: null };
    table('activity_hours').push(entry);
    recordHistory(entry, 'baseline', str(profileOf(uid)?.name), '', null);
    return entry.id;
  },

  withdraw_activity_hours: (a, uid) => {
    const entry = table('activity_hours').find(h => h.id === a.target_entry_id && h.student_id === uid);
    if (!entry || entry.status !== 'pending') fail('40001', 'Only pending entries can be withdrawn.', 409);
    versionCheck(entry!, a.expected_updated_at);
    data().activity_hours = table('activity_hours').filter(h => h !== entry);
    data().activity_hour_reviews = table('activity_hour_reviews').filter(r => r.entry_id !== entry!.id);
    return null;
  },

  review_activity_hours: (a, uid) => {
    const entry = table('activity_hours').find(h => h.id === a.target_entry_id);
    if (!entry || !canManage(entry.opportunity_id, uid)) denied();
    if (entry!.student_id === uid) denied('You cannot review your own hours.');
    if (entry!.status !== 'pending') fail('40001', 'This entry was already reviewed.', 409);
    versionCheck(entry!, a.expected_updated_at);
    const before = hourState(entry!);
    const reviewer = str(profileOf(uid)?.name);
    Object.assign(entry!, { status: a.decision, reviewed_by: uid, reviewer_name: reviewer, review_note: str(a.reviewer_note),
      reviewed_at: now(), updated_at: now() });
    recordHistory(entry!, 'review', reviewer, str(a.reviewer_note), before);
    const title = str(oppOf(entry!.opportunity_id)?.title);
    const day = new Date(`${entry!.service_date}T12:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    notify(str(entry!.student_id), 'hours_reviewed', `${a.decision === 'approved' ? 'Hours approved: ' : 'Hours not approved: '}${title}`,
      `${Number(entry!.hours)} hours on ${day}${a.decision === 'approved' ? ' now count towards your portfolio.' : '. Open the activity to see the reviewer\'s note.'}`,
      str(entry!.opportunity_id), `/activity/${entry!.opportunity_id}`);
    return null;
  },

  correct_activity_hours: (a, uid) => {
    const entry = table('activity_hours').find(h => h.id === a.target_entry_id);
    if (!entry || !canManage(entry.opportunity_id, uid) || entry.student_id === uid) denied();
    if (entry!.status === 'pending') fail('23514', 'Review the entry before correcting it.');
    if (!str(a.correction_reason).trim()) fail('23514', 'Give a reason for the correction.');
    versionCheck(entry!, a.expected_updated_at);
    const before = hourState(entry!);
    const reviewer = str(profileOf(uid)?.name);
    Object.assign(entry!, { hours: Number(a.corrected_hours), status: a.corrected_status, reviewer_name: reviewer,
      reviewed_by: uid, reviewed_at: now(), updated_at: now() });
    recordHistory(entry!, 'correction', reviewer, str(a.correction_reason).trim(), before);
    return true;
  },

  get_my_service_portfolio: (_a, uid) => {
    const me = requireMember(uid);
    const mine = table('activity_hours').filter(h => h.student_id === me);
    const total = (s: string) => mine.filter(h => h.status === s).reduce((n, h) => n + Number(h.hours), 0);
    return {
      approved_hours: total('approved'), pending_hours: total('pending'), rejected_hours: total('rejected'),
      approved_activities: new Set(mine.filter(h => h.status === 'approved').map(h => h.opportunity_id)).size,
      entries: orderRows(mine, 'service_date.desc').map(h => {
        const opp = oppOf(h.opportunity_id);
        return { ...h, activity_title: str(opp?.title), activity_category: str(opp?.category), activity_status: str(opp?.status),
          review_history: historyOf(h.id) };
      }),
    };
  },

  list_activity_messages: (a, uid) => {
    const oppId = a.target_opportunity_id;
    if (!canRead(oppId, uid)) denied();
    if ((a.cursor_time == null) !== (a.cursor_id == null)) fail('23514', 'Both cursor fields are required');
    const all = orderRows(table('activity_messages').filter(m => m.opportunity_id === oppId), 'created_at.asc,id.asc');
    const key = (m: Row) => `${m.created_at}|${m.id}`;
    const cursor = a.cursor_time == null ? null : `${a.cursor_time}|${a.cursor_id}`;
    if (a.newer) return all.filter(m => !cursor || key(m) > cursor).slice(0, 50).map(noNonce);
    return all.filter(m => !cursor || key(m) < cursor).slice(-50).map(noNonce);
  },

  send_activity_message: (a, uid) => {
    const oppId = a.target_opportunity_id;
    if (!canRead(oppId, uid)) denied();
    const content = str(a.message_content).trim();
    if (!content || content.length > 2000) fail('23514', 'Messages must contain 1–2000 characters.');
    const list = table('activity_messages');
    const repeat = list.find(m => m.sender_id === uid && m.client_nonce === a.request_nonce);
    if (repeat) return noNonce(repeat);
    const me = profileOf(uid)!;
    const stampNow = now();
    const row: Row = { id: uuid(), opportunity_id: oppId, sender_id: uid, sender_name: me.name, sender_role: me.role, content,
      client_nonce: a.request_nonce, created_at: stampNow, updated_at: stampNow, edited_at: null, deleted_at: null };
    list.push(row);
    return noNonce(row);
  },

  get_activity_message_updates: (a, uid) => {
    if (!canRead(a.target_opportunity_id, uid)) denied();
    const ids = new Set((a.message_ids as string[] | null) ?? []);
    return table('activity_messages').filter(m => m.opportunity_id === a.target_opportunity_id && ids.has(str(m.id))).map(noNonce);
  },

  change_my_activity_message: (a, uid) => {
    const m = table('activity_messages').find(x => x.id === a.target_message_id);
    if (!m || m.sender_id !== uid || !canRead(m.opportunity_id, uid)) denied();
    if (m!.deleted_at) fail('40001', 'This message was removed.', 409);
    versionCheck(m!, a.expected_updated_at);
    const stampNow = now();
    if (a.remove_message) Object.assign(m!, { content: '', deleted_at: stampNow, updated_at: stampNow });
    else {
      const content = str(a.replacement_content).trim();
      if (!content || content.length > 2000) fail('23514', 'Messages must contain 1–2000 characters.');
      Object.assign(m!, { content, edited_at: stampNow, updated_at: stampNow });
    }
    return noNonce(m!);
  },

  get_my_activity_reflections: (a, uid) => {
    const me = requireMember(uid);
    let mine = table('activity_reflections').filter(r => r.student_id === me
      && (a.target_opportunity_id == null || r.opportunity_id === a.target_opportunity_id));
    mine = orderRows(mine, 'created_at.desc,id.desc');
    if (a.before_created_at != null) {
      const cursor = `${a.before_created_at}|${a.before_id}`;
      mine = mine.filter(r => `${r.created_at}|${r.id}` < cursor);
    }
    return {
      can_create: a.target_opportunity_id != null && isAccepted(a.target_opportunity_id, me),
      entries: mine.slice(0, 50).map(r => { const { student_id: _s, ...rest } = r; void _s; return rest; }),
    };
  },

  save_my_activity_reflection: (a, uid) => {
    const me = requireMember(uid);
    const content = str(a.reflection_content).trim();
    if (words(content) < 30 || content.length > 10000) fail('23514', 'Write at least 30 words and no more than 10,000 characters.');
    const list = table('activity_reflections');
    const existing = list.find(r => r.id === a.target_reflection_id);
    const stampNow = now();
    if (existing) {
      if (existing.student_id !== me) denied();
      versionCheck(existing, a.expected_updated_at);
      Object.assign(existing, { content, updated_at: stampNow });
      const { student_id: _s, ...rest } = existing; void _s; return rest;
    }
    if (!isAccepted(a.target_opportunity_id, me)) denied('Only accepted students can start new activity reflections.');
    const row: Row = { id: a.target_reflection_id ?? uuid(), opportunity_id: a.target_opportunity_id,
      activity_title: str(oppOf(a.target_opportunity_id)?.title), student_id: me, content, created_at: stampNow, updated_at: stampNow };
    list.push(row);
    const { student_id: _s, ...rest } = row; void _s; return rest;
  },

  delete_my_activity_reflection: (a, uid) => {
    const r = table('activity_reflections').find(x => x.id === a.target_reflection_id);
    if (!r || r.student_id !== uid) denied();
    versionCheck(r!, a.expected_updated_at);
    data().activity_reflections = table('activity_reflections').filter(x => x !== r);
    return null;
  },

  get_managed_activity_reflections: (a, uid) => {
    if (!canManage(a.target_opportunity_id, uid)) denied();
    let list = orderRows(table('activity_reflections').filter(r => r.opportunity_id === a.target_opportunity_id), 'created_at.desc,id.desc');
    if (a.before_created_at != null) {
      const cursor = `${a.before_created_at}|${a.before_id}`;
      list = list.filter(r => `${r.created_at}|${r.id}` < cursor);
    }
    return list.slice(0, 50).map(r => ({ ...r, author_name: str(profileOf(str(r.student_id))?.name) || 'Student' }));
  },

  queue_my_reminders: (_a, uid) => {
    const me = requireMember(uid);
    const today = zurichDate(), plus2 = zurichDate(2), tomorrow = zurichDate(1);
    let added = 0;
    table('saved_opportunities').filter(s => s.user_id === me).forEach(s => {
      const o = oppOf(s.opportunity_id);
      if (!o || o.status !== 'active') return;
      const deadline = str(o.application_deadline);
      if (deadline < today || deadline > plus2) return;
      if (table('applications').some(x => x.opportunity_id === o.id && x.applicant_id === me)) return;
      const body = deadline === today ? 'Applications close today.' : deadline === tomorrow ? 'Applications close tomorrow.' : 'Applications close in 2 days.';
      if (notify(me, 'deadline_reminder', `Deadline soon: ${str(o.title)}`, body, str(o.id), `/opportunities/${o.id}`, `deadline:${o.id}:${deadline}`)) added++;
    });
    table('activity_sessions').filter(s => s.session_date === tomorrow && canRead(s.opportunity_id, me)).forEach(s => {
      const o = oppOf(s.opportunity_id);
      if (notify(me, 'session_reminder', `Tomorrow: ${str(s.title)}`, `${str(o?.title)} · ${str(s.start_time).slice(0, 5)} · ${str(s.location)}`,
        str(s.opportunity_id), `/activity/${s.opportunity_id}`, `session:${s.id}:${s.session_date}`)) added++;
    });
    return added;
  },

  mark_my_notifications_read: (a, uid) => {
    const me = requireMember(uid);
    const ids = a.notification_ids as string[] | null | undefined;
    let n = 0;
    table('notifications').forEach(x => {
      if (x.user_id === me && !x.read_at && (!ids || ids.includes(str(x.id)))) { x.read_at = now(); n++; }
    });
    return n;
  },

  report_activity_message: (a, uid) => {
    const m = table('activity_messages').find(x => x.id === a.target_message_id);
    if (!m || !canRead(m.opportunity_id, uid)) denied('Only current group members can report this message');
    if (m!.sender_id === uid) fail('23514', 'You cannot report your own message; edit or remove it instead');
    if (m!.deleted_at) fail('23514', 'This message was already removed');
    const list = table('message_reports');
    const existing = list.find(r => r.message_id === m!.id && r.reporter_id === uid);
    if (existing) return { id: existing.id, status: existing.status, already_reported: true };
    const title = str(oppOf(m!.opportunity_id)?.title) || 'Activity';
    const row: Row = { id: uuid(), message_id: m!.id, opportunity_id: m!.opportunity_id, activity_title: title, reporter_id: uid,
      reporter_name: str(profileOf(uid)?.name), sender_id: m!.sender_id, sender_name: m!.sender_name, message_snapshot: m!.content,
      message_sent_at: m!.created_at, reason: a.report_reason, details: str(a.report_details).trim(), status: 'open', resolution_note: '',
      message_removed: false, resolved_by: null, resolver_name: '', resolved_at: null, created_at: now() };
    list.push(row);
    adminIds().forEach(id => notify(id, 'report_update', 'Message reported', `A group message in ${title} needs review.`, null, '/admin?tab=reports', `report:${row.id}`));
    return { id: row.id, status: 'open', already_reported: false };
  },

  get_message_reports: (a, uid) => {
    if (!isAdmin(uid)) denied('School admin access required');
    const f = str(a.status_filter || 'open');
    return orderRows(table('message_reports').filter(r => f === 'all' || (f === 'open') === (r.status === 'open')), 'created_at.desc')
      .map(r => ({ ...r, message_currently_removed: !!table('activity_messages').find(m => m.id === r.message_id)?.deleted_at
        || !table('activity_messages').some(m => m.id === r.message_id) }));
  },

  resolve_message_report: (a, uid) => {
    if (!isAdmin(uid)) denied('School admin access required');
    const report = table('message_reports').find(r => r.id === a.target_report_id);
    if (!report) fail('P0002', 'Report not found');
    if (report!.status !== 'open') fail('40001', 'This report was already resolved', 409);
    const remove = !!a.remove_message;
    if (remove) {
      const m = table('activity_messages').find(x => x.id === report!.message_id && !x.deleted_at);
      if (m) { const t = now(); Object.assign(m, { content: '', deleted_at: t, updated_at: t }); }
    }
    const t = now(), admin = str(profileOf(uid)?.name) || 'School admin';
    table('message_reports').filter(r => r.status === 'open' && (r.id === report!.id || r.message_id === report!.message_id)).forEach(r => {
      Object.assign(r, { status: a.resolution, resolution_note: str(a.note).trim(), message_removed: remove, resolved_by: uid,
        resolver_name: admin, resolved_at: t });
      notify(str(r.reporter_id), 'report_update', 'Your report was reviewed',
        `A school admin reviewed the message you reported in ${str(r.activity_title)}. Thank you for speaking up.`, null, '', `report-reviewed:${r.id}`);
    });
    return { id: report!.id, status: a.resolution, message_removed: remove };
  },

  submit_privacy_request: (a, uid) => {
    const me = requireMember(uid);
    const kind = str(a.request_kind), details = str(a.request_details).trim();
    if (!['access', 'correction', 'deletion', 'question'].includes(kind)) fail('23514', 'Choose a request type');
    if (['correction', 'question'].includes(kind) && !details) fail('23514', 'Describe what you would like changed or answered');
    const list = table('privacy_requests');
    if (list.some(r => r.requester_id === me && r.kind === kind && ['open', 'in_progress'].includes(str(r.status)))) {
      fail('23505', 'You already have an open request of this type', 409);
    }
    const p = profileOf(me)!, t = now();
    const row: Row = { id: uuid(), requester_id: me, requester_name: p.name, requester_email: p.email, kind, details, status: 'open',
      response: '', handled_by: null, handler_name: '', created_at: t, updated_at: t };
    list.push(row);
    adminIds().forEach(id => notify(id, 'privacy_request_update', 'New privacy request', `A ${kind} request is waiting in the admin panel.`, null, '/admin?tab=privacy'));
    return row;
  },

  get_my_privacy_requests: (_a, uid) => {
    const me = requireMember(uid);
    return orderRows(table('privacy_requests').filter(r => r.requester_id === me), 'created_at.desc');
  },

  get_privacy_requests: (a, uid) => {
    if (!isAdmin(uid)) denied('School admin access required');
    const f = str(a.status_filter || 'open');
    return orderRows(table('privacy_requests').filter(r => f === 'all'
      || (f === 'open' && ['open', 'in_progress'].includes(str(r.status)))
      || (f === 'closed' && ['completed', 'declined'].includes(str(r.status)))), 'created_at.asc');
  },

  update_privacy_request: (a, uid) => {
    if (!isAdmin(uid)) denied('School admin access required');
    const status = str(a.new_status), response = str(a.admin_response).trim();
    if (!['in_progress', 'completed', 'declined'].includes(status)) fail('23514', 'Unknown status');
    if (['completed', 'declined'].includes(status) && !response) fail('23514', 'Explain the outcome to the student');
    const r = table('privacy_requests').find(x => x.id === a.target_request_id);
    if (!r) fail('P0002', 'Request not found');
    if (['completed', 'declined'].includes(str(r!.status))) fail('40001', 'This request is already closed', 409);
    Object.assign(r!, { status, response, handled_by: uid, handler_name: str(profileOf(uid)?.name), updated_at: now() });
    notify(str(r!.requester_id), 'privacy_request_update',
      status === 'in_progress' ? 'Your privacy request is being handled' : 'Your privacy request was answered',
      'See Profile → Your data for details.', null, '/profile#your-data', `privacy:${r!.id}:${status}`);
    return r;
  },

  export_my_data: (_a, uid) => {
    const me = requireMember(uid);
    const p = profileOf(me)!;
    const pick = (t: string, col: string) => table(t).filter(r => r[col] === me);
    return {
      exported_at: now(), demo: true,
      account: { id: me, email: p.email },
      profile: p,
      applications: pick('applications', 'applicant_id'),
      saved_opportunities: pick('saved_opportunities', 'user_id').map(s => ({ opportunity_id: s.opportunity_id,
        title: oppOf(s.opportunity_id)?.title, saved_at: s.created_at })),
      attendance: pick('activity_attendance', 'student_id'),
      service_hours: pick('activity_hours', 'student_id'),
      reflections: pick('activity_reflections', 'student_id'),
      messages_sent: pick('activity_messages', 'sender_id').map(noNonce),
      reports_made: pick('message_reports', 'reporter_id').map(r => ({ activity_title: r.activity_title, reason: r.reason,
        details: r.details, status: r.status, created_at: r.created_at })),
      notifications: pick('notifications', 'user_id'),
      privacy_requests: pick('privacy_requests', 'requester_id'),
    };
  },
};

// ── Auth ───────────────────────────────────────────────────────────────────
const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function authUser(uid: string) {
  const p = profileOf(uid) ?? (() => { const persona = personaById(uid); return persona ? { name: persona.name, email: persona.email } : null; })();
  if (!p) return null;
  return { id: uid, aud: 'authenticated', role: 'authenticated', email: p.email, email_confirmed_at: '2026-01-01T00:00:00Z',
    phone: '', app_metadata: { provider: 'demo', providers: ['demo'] }, user_metadata: { full_name: p.name },
    identities: [], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', is_anonymous: false };
}
function session(uid: string) {
  const expiresIn = 60 * 60 * 24 * 7;
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const user = authUser(uid);
  const token = `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify({
    sub: uid, email: user?.email, role: 'authenticated', aud: 'authenticated', exp, iat: exp - expiresIn }))}.demo`;
  return { access_token: token, token_type: 'bearer', expires_in: expiresIn, expires_at: exp, refresh_token: `demo-${uid}`, user };
}
function uidFromHeaders(headers: Headers): string | null {
  const token = (headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || token === DEMO_ANON_KEY) return null;
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))));
    return typeof payload.sub === 'string' && profileOf(payload.sub) ? payload.sub : null;
  } catch { return null; }
}

function handleAuth(path: string, params: URLSearchParams, body: Row | null, headers: Headers) {
  if (path.endsWith('/token')) {
    const grant = params.get('grant_type');
    let uid: string | null = null;
    if (grant === 'password') {
      const persona = Object.values(DEMO_PERSONAS).find(p => p.email === body?.email);
      if (persona && body?.password === DEMO_PASSWORD) uid = persona.id;
    } else if (grant === 'refresh_token') {
      uid = str(body?.refresh_token).replace(/^demo-/, '') || null;
    }
    if (!uid || !profileOf(uid)) return { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid demo login', code: 'invalid_credentials' } };
    return { status: 200, body: session(uid) };
  }
  if (path.endsWith('/user')) {
    const uid = uidFromHeaders(headers);
    const user = uid ? authUser(uid) : null;
    return user ? { status: 200, body: user } : { status: 401, body: { code: 401, msg: 'Not signed in' } };
  }
  if (path.endsWith('/logout')) return { status: 204, body: null };
  return { status: 200, body: {} };
}

// ── fetch entry point ──────────────────────────────────────────────────────
function respond(status: number, body: unknown, count?: number): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (count !== undefined) headers['content-range'] = count ? `0-${count - 1}/${count}` : '*/0';
  return new Response(status === 204 || body === null ? null : JSON.stringify(body), { status: body === null && status === 200 ? 204 : status, headers });
}

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (!request.url.startsWith(DEMO_SUPABASE_URL)) return fetch(input, init);
  // A small delay keeps loading states realistic without slowing the demo down.
  await new Promise(resolve => setTimeout(resolve, 60));
  const text = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  const path = url.pathname;
  try {
    if (path.startsWith('/auth/v1/')) {
      const r = handleAuth(path, url.searchParams, body as Row | null, request.headers);
      return respond(r.status, r.body);
    }
    const uid = uidFromHeaders(request.headers);
    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.slice('/rest/v1/rpc/'.length);
      const fn = RPC[name];
      if (!fn) return respond(404, { code: 'PGRST202', message: `Could not find the function public.${name}`, details: null, hint: null });
      const args = (body ?? Object.fromEntries(url.searchParams)) as Args;
      const result = fn(args, uid);
      persist();
      return respond(200, result === undefined ? null : result);
    }
    if (path.startsWith('/rest/v1/')) {
      const tableName = path.slice('/rest/v1/'.length);
      const r = handleRest(request.method, tableName, url.searchParams, request.headers, body, uid);
      return respond(r.status, r.body, r.count);
    }
    return respond(404, { message: 'Not found' });
  } catch (err) {
    if (err instanceof DemoError) return respond(err.status, { code: err.code, message: err.message, details: null, hint: null });
    return respond(500, { code: 'XX000', message: 'The demo hit an unexpected problem. Use “Reset demo” to start again.', details: null, hint: null });
  }
}

/** Realtime is not needed in the demo: a socket that never connects keeps the client quiet. */
export class DemoSocket {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  readyState = 3; binaryType = 'arraybuffer'; url: string; protocol = ''; bufferedAmount = 0; extensions = '';
  onopen: ((ev: unknown) => void) | null = null; onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null; onmessage: ((ev: unknown) => void) | null = null;
  constructor(url: string | URL) { this.url = String(url); }
  send() { /* no-op */ }
  close() { this.readyState = 3; }
  addEventListener() { /* no-op */ }
  removeEventListener() { /* no-op */ }
  dispatchEvent() { return false; }
}
