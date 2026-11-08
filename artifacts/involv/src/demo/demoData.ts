import { DEMO_PERSONAS } from './demoMode';

/** All dates are relative to today so the demo never goes stale. */
export type Row = Record<string, unknown>;
export interface DemoDb { [table: string]: Row[] }

const DAY = 86_400_000;
export function zurichDate(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + offsetDays * DAY));
}
export function stamp(offsetDays = 0, hour = 10): string {
  const d = new Date(`${zurichDate(offsetDays)}T${String(hour).padStart(2, '0')}:00:00Z`);
  return d.toISOString();
}
const longDate = (offset: number) => new Date(`${zurichDate(offset)}T12:00:00Z`)
  .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const id = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const S = DEMO_PERSONAS.student, T = DEMO_PERSONAS.teacher, A = DEMO_PERSONAS.admin;
const NOAH = { id: id(11), name: 'Noah Fischer', email: 'noah.fischer.demo@iszl.ch', grade: '11' };
const LEA = { id: id(12), name: 'Lea Meier', email: 'lea.meier.demo@iszl.ch', grade: '12' };
const SAM = { id: id(13), name: 'Samuel Okafor', email: 'samuel.okafor.demo@iszl.ch', grade: '10' };
const EMMA = { id: id(14), name: 'Emma Rossi', email: 'emma.rossi.demo@iszl.ch', grade: '11' };
const JONAS = { id: id(15), name: 'Jonas Weber', email: 'jonas.weber.demo@iszl.ch', grade: '12' };

export const OPP = {
  market: id(101), lake: id(102), tutoring: id(103), care: id(104),
  food: id(105), reading: id(106), garden: id(107), past: id(108),
};

function profile(p: { id: string; name: string; email: string }, role: string, grade: string | null, extra: Row = {}): Row {
  return {
    id: p.id, name: p.name, email: p.email, role, photo_url: null, grade, bio: null,
    interests: [], career_goals: [], skills: [], availability: [], preferred_categories: [],
    onboarding_complete: true, created_at: stamp(-40), updated_at: stamp(-40), ...extra,
  };
}

function opportunity(o: Row): Row {
  const owner = o.organizer_id === T.id;
  return {
    organizer_id: null, organizer_name: owner ? 'Ms Laura Rivera' : 'ISZL Service Learning Office',
    organizer_role: owner ? 'Teacher' : 'School admin', organizer_email: owner ? T.email : A.email,
    location_type: 'On-campus', location_text: 'ISZL Zug campus', duration_type: 'One-time', skill_level: 'Beginner',
    impact_type: 'Direct', service_programs: ['IB DP', 'HSP'], skills_required: [], min_grade_or_age: 'Grade 9+',
    language_requirements: ['English'], positions_available: 10, start_date: null, skills_gained: [],
    cv_relevance: '', impact_description: '', tags: [], featured: false, applicants_count: 0, status: 'active',
    created_at: stamp(-20), updated_at: stamp(-20), ...o,
  };
}

function application(n: number, oppId: string, title: string, who: { id: string; name: string; email: string; grade: string },
  status: string, daysAgo: number, organizer: string | null, motivation: string): Row {
  return {
    id: id(n), opportunity_id: oppId, opportunity_title: title, applicant_id: who.id, applicant_name: who.name,
    applicant_email: who.email, organizer_id: organizer, grade: who.grade, motivation,
    relevant_experience: 'Helped at last year\'s school events.', availability: 'Afternoons and weekends',
    status, submitted_date: stamp(-daysAgo), updated_at: stamp(-daysAgo + 1),
  };
}

export function buildDemoDb(): DemoDb {
  const mia = { id: S.id, name: S.name, email: S.email, grade: '11' };
  const marketTitle = 'ISZL Winter Market — Volunteer Team';
  const opportunities = [
    opportunity({
      id: OPP.market, organizer_id: T.id, title: marketTitle, category: 'School-Based Service', featured: true,
      short_description: 'Run stalls, games and the hot-chocolate stand at the school\'s winter market.',
      full_description: 'The Winter Market raises money for our partner charities. Volunteers set up stalls, run games for younger students, sell crafts and help pack down afterwards. You will be part of a team with a shift leader and a short briefing beforehand.',
      dates: longDate(19), time_commitment: '15:00–18:30 plus a 30-minute briefing', start_date: zurichDate(19),
      application_deadline: zurichDate(12), positions_available: 12, skills_required: ['Teamwork', 'Friendly communication'],
      skills_gained: ['Event organisation', 'Customer service', 'Teamwork'], impact_description: 'All proceeds go to the school\'s partner charities.',
      tags: ['event', 'fundraising'],
    }),
    opportunity({
      id: OPP.lake, organizer_id: T.id, title: 'Zugersee Shoreline Clean-Up', category: 'Sustainability & Environment', featured: true,
      short_description: 'Collect and sort litter along the lake shore with the Eco Club.',
      full_description: 'Join the Eco Club for a morning on the Zugersee shoreline. We collect, sort and record litter for a local environmental survey. Gloves, bags and grabbers are provided.',
      location_type: 'Off-campus', location_text: 'Zug lakeside promenade', dates: longDate(14), time_commitment: '09:00–12:00',
      start_date: zurichDate(14), application_deadline: zurichDate(9), positions_available: 20,
      skills_gained: ['Environmental awareness', 'Data recording'], impact_type: 'Direct', tags: ['outdoors', 'environment'],
    }),
    opportunity({
      id: OPP.tutoring, organizer_id: T.id, title: 'Peer Maths Tutoring', category: 'Education & Mentorship',
      short_description: 'Help Grade 7–8 students with maths homework once a week.',
      full_description: 'Support younger students in a weekly homework club. You will be paired with one or two students and work through problems together. A short training session is held before the first week.',
      duration_type: 'Ongoing', dates: 'Every Wednesday', time_commitment: '1 hour per week (15:30–16:30)', start_date: zurichDate(10),
      application_deadline: zurichDate(7), positions_available: 6, skill_level: 'Intermediate', min_grade_or_age: 'Grade 10+',
      skills_required: ['Strong maths'], skills_gained: ['Teaching', 'Patience', 'Leadership'], service_programs: ['IB DP'], tags: ['tutoring'],
    }),
    opportunity({
      id: OPP.care, title: 'Care Home Afternoon Visits', category: 'Community & Social Impact',
      short_description: 'Spend an afternoon playing games and chatting with residents.',
      full_description: 'Visit a local care home in small groups to play board games, read and chat with residents. German is helpful but not required.',
      location_type: 'Off-campus', location_text: 'Zug (10 minutes by bus)', duration_type: 'Fixed period', dates: 'Fridays for 6 weeks',
      time_commitment: '2 hours per visit', start_date: zurichDate(16), application_deadline: zurichDate(11), positions_available: 8,
      language_requirements: ['English', 'German (helpful)'], skills_gained: ['Empathy', 'Communication'], tags: ['community'],
    }),
    opportunity({
      id: OPP.food, title: 'Food Drive for the Local Food Bank', category: 'Community & Social Impact',
      short_description: 'Collect, sort and deliver donations during the school food drive.',
      full_description: 'Help run collection points around school, sort donations by date and type, and help deliver them to the local food bank.',
      dates: 'This week', time_commitment: 'Flexible 30-minute slots', start_date: zurichDate(4), application_deadline: zurichDate(1),
      positions_available: 15, impact_type: 'Indirect', skills_gained: ['Organisation'], tags: ['food', 'charity'],
    }),
    opportunity({
      id: OPP.reading, organizer_id: T.id, title: 'Primary Reading Buddies', category: 'Education & Mentorship',
      short_description: 'Read with Primary School students during lunch break.',
      full_description: 'Pair up with a Primary School reader twice a week to listen, encourage and talk about books together.',
      duration_type: 'Ongoing', dates: 'Tuesdays and Thursdays', time_commitment: '30 minutes, twice a week', start_date: zurichDate(8),
      application_deadline: zurichDate(21), positions_available: 10, skills_gained: ['Mentoring', 'Communication'], tags: ['reading'],
    }),
    opportunity({
      id: OPP.garden, organizer_id: T.id, title: 'School Garden Redesign (Advocacy project)', category: 'Sustainability & Environment',
      short_description: 'Research and pitch a pollinator-friendly design for the school garden.',
      full_description: 'Work in a small team to research native plants, survey students and present a redesign proposal to school leadership.',
      duration_type: 'Fixed period', dates: 'Over 4 weeks', time_commitment: '2 hours per week', start_date: zurichDate(12),
      application_deadline: zurichDate(18), positions_available: 5, impact_type: 'Advocacy', skill_level: 'Intermediate',
      skills_gained: ['Research', 'Presenting', 'Persuasion'], tags: ['research', 'environment'],
    }),
    opportunity({
      id: OPP.past, organizer_id: T.id, title: 'Autumn Charity Bake Sale', category: 'School-Based Service', status: 'closed',
      short_description: 'Bake and sell treats for charity.', full_description: 'Our autumn bake sale raised money for a local charity.',
      dates: longDate(-25), start_date: zurichDate(-25), application_deadline: zurichDate(-30), created_at: stamp(-45),
    }),
  ];

  const applications = [
    application(201, OPP.market, marketTitle, mia, 'Accepted', 9, T.id, 'I love organising events and want to help raise money for our partner charities.'),
    application(202, OPP.market, marketTitle, NOAH, 'Accepted', 8, T.id, 'I helped at the summer fair and would like to run the games stall.'),
    application(203, OPP.market, marketTitle, LEA, 'Accepted', 8, T.id, 'I can help with setting up and packing down.'),
    application(204, OPP.market, marketTitle, SAM, 'Pending', 2, T.id, 'I would like to get involved in more school events this year.'),
    application(205, OPP.market, marketTitle, EMMA, 'Under Review', 3, T.id, 'I enjoy baking and could help run the food stall.'),
    application(206, OPP.tutoring, 'Peer Maths Tutoring', mia, 'Pending', 1, T.id, 'Maths is my strongest subject and I enjoy explaining things.'),
    application(207, OPP.tutoring, 'Peer Maths Tutoring', JONAS, 'Pending', 2, T.id, 'I tutor my younger brother and would like to help others too.'),
    application(208, OPP.lake, 'Zugersee Shoreline Clean-Up', NOAH, 'Pending', 1, T.id, 'I care about keeping the lake clean.'),
    application(209, OPP.care, 'Care Home Afternoon Visits', LEA, 'Pending', 2, null, 'My grandmother lives in a care home and I know how much visits mean.'),
    application(210, OPP.past, 'Autumn Charity Bake Sale', mia, 'Accepted', 34, T.id, 'I would like to bake for the sale.'),
  ];
  const counts: Record<string, number> = {};
  applications.forEach(a => { counts[a.opportunity_id as string] = (counts[a.opportunity_id as string] ?? 0) + 1; });
  opportunities.forEach(o => { o.applicants_count = counts[o.id as string] ?? 0; });

  const sessions = [
    { id: id(301), opportunity_id: OPP.market, created_by: T.id, title: 'Volunteer briefing', session_date: zurichDate(-2),
      start_time: '12:30:00', end_time: '13:00:00', location: 'Room B204', notes: 'Roles and shift plan.', created_at: stamp(-6), updated_at: stamp(-6) },
    { id: id(302), opportunity_id: OPP.market, created_by: T.id, title: 'Stall preparation', session_date: zurichDate(1),
      start_time: '15:30:00', end_time: '17:00:00', location: 'Art room', notes: 'Make signs and price labels.', created_at: stamp(-6), updated_at: stamp(-6) },
    { id: id(303), opportunity_id: OPP.market, created_by: T.id, title: 'Winter Market', session_date: zurichDate(19),
      start_time: '15:00:00', end_time: '18:30:00', location: 'Main hall and courtyard', notes: 'Wear warm clothes!', created_at: stamp(-6), updated_at: stamp(-6) },
  ];
  const announcements = [
    { id: id(401), opportunity_id: OPP.market, author_id: T.id, author_name: 'Laura Rivera', author_role: 'teacher',
      title: 'Welcome to the Winter Market team!', body: 'Thanks for signing up. Please check the session dates and bring ideas for the games stall to the briefing.',
      pinned: true, created_at: stamp(-7, 9), updated_at: stamp(-7, 9) },
    { id: id(402), opportunity_id: OPP.market, author_id: T.id, author_name: 'Laura Rivera', author_role: 'teacher',
      title: 'Shift plan posted', body: 'The shift plan is on the noticeboard outside B204. Tell me by Friday if you need to swap.',
      pinned: false, created_at: stamp(-1, 14), updated_at: stamp(-1, 14) },
  ];
  const attendance = [mia, NOAH, LEA].map((s, i) => ({
    id: id(501 + i), opportunity_id: OPP.market, session_id: id(301), student_id: s.id, student_name: s.name,
    present: s.id !== LEA.id, marked_by: T.id, marked_by_name: 'Laura Rivera', updated_at: stamp(-2, 13),
  }));
  const hourRow = (n: number, who: { id: string; name: string }, opp: string, day: number, hours: number, desc: string, status: string): Row => ({
    id: id(n), opportunity_id: opp, student_id: who.id, student_name: who.name, service_date: zurichDate(day), hours,
    description: desc, status, submitted_at: stamp(day, 18), updated_at: stamp(status === 'pending' ? day : day + 1, 18),
    reviewed_by: status === 'pending' ? null : T.id, reviewer_name: status === 'pending' ? '' : 'Laura Rivera',
    review_note: status === 'approved' ? 'Great work, thank you!' : '', reviewed_at: status === 'pending' ? null : stamp(day + 1, 18),
  });
  const hours = [
    hourRow(601, mia, OPP.past, -25, 3, 'Baked and sold cakes at the autumn bake sale.', 'approved'),
    hourRow(602, mia, OPP.market, -2, 0.5, 'Attended the volunteer briefing.', 'approved'),
    hourRow(603, mia, OPP.market, -1, 1.5, 'Designed price labels and signs for the craft stall.', 'pending'),
    hourRow(604, NOAH, OPP.market, -2, 0.5, 'Attended the volunteer briefing.', 'pending'),
  ];
  const hourReviews: Row[] = hours.flatMap(h => {
    const base = { hours: h.hours, status: 'pending', reviewer_name: '', reviewed_at: null };
    const out: Row[] = [{ id: `${h.id}-b`, entry_id: h.id, kind: 'baseline', actor_name: h.student_name, reason: '', before_state: null,
      after_state: base, recorded_at: h.submitted_at }];
    if (h.status !== 'pending') out.push({ id: `${h.id}-r`, entry_id: h.id, kind: 'review', actor_name: 'Laura Rivera', reason: h.review_note,
      before_state: base, after_state: { hours: h.hours, status: h.status, reviewer_name: 'Laura Rivera', reviewed_at: h.reviewed_at }, recorded_at: h.reviewed_at });
    return out;
  });
  const msg = (n: number, who: { id: string; name: string }, role: string, text: string, day: number, hour: number): Row => ({
    id: id(n), opportunity_id: OPP.market, sender_id: who.id, sender_name: who.name, sender_role: role, content: text,
    client_nonce: id(n + 5000), created_at: stamp(day, hour), updated_at: stamp(day, hour), edited_at: null, deleted_at: null,
  });
  const messages = [
    msg(701, { id: T.id, name: 'Laura Rivera' }, 'teacher', 'Hi everyone! Use this chat for questions about the Winter Market.', -7, 9),
    msg(702, NOAH, 'student', 'Can we do a hot-chocolate stand again this year?', -6, 15),
    msg(703, { id: T.id, name: 'Laura Rivera' }, 'teacher', 'Yes! Noah, could you lead it with Lea?', -6, 16),
    msg(704, LEA, 'student', 'Happy to help. I can bring the big flask from home.', -6, 17),
    msg(705, { id: S.id, name: S.name }, 'student', 'I made a first draft of the price labels, will bring them on Thursday.', -1, 16),
    msg(706, NOAH, 'student', 'lol nobody is going to buy your ugly labels', -1, 17),
  ];
  const reflections = [
    { id: id(801), opportunity_id: OPP.past, activity_title: 'Autumn Charity Bake Sale', student_id: S.id,
      content: 'Running the bake sale stall taught me how much planning goes into a small event. We sold out by the second break, and I learnt to manage the cash box and keep track of what sold. Next time I would make more savoury options because many students asked for them. Working with younger students was fun and I felt more confident talking to people I did not know.',
      created_at: stamp(-24, 19), updated_at: stamp(-24, 19) },
  ];
  const notifications = [
    { id: id(901), user_id: S.id, kind: 'announcement', title: `New announcement: ${marketTitle}`, body: 'Shift plan posted',
      opportunity_id: OPP.market, link: `/activity/${OPP.market}`, dedupe_key: null, read_at: null, created_at: stamp(-1, 14) },
    { id: id(902), user_id: S.id, kind: 'hours_reviewed', title: `Hours approved: ${marketTitle}`, body: '0.5 hours now count towards your portfolio.',
      opportunity_id: OPP.market, link: `/activity/${OPP.market}`, dedupe_key: null, read_at: stamp(-1, 9), created_at: stamp(-1, 8) },
    { id: id(903), user_id: S.id, kind: 'application_update', title: `Accepted: ${marketTitle}`, body: 'You have a place. Open the activity hub for announcements and sessions.',
      opportunity_id: OPP.market, link: `/activity/${OPP.market}`, dedupe_key: null, read_at: stamp(-8, 9), created_at: stamp(-8, 8) },
    { id: id(904), user_id: T.id, kind: 'application_received', title: `New application: ${marketTitle}`, body: 'A student applied. Review it from your organiser dashboard.',
      opportunity_id: OPP.market, link: `/applications/${OPP.market}`, dedupe_key: null, read_at: null, created_at: stamp(-2, 11) },
    { id: id(905), user_id: T.id, kind: 'application_received', title: 'New application: Peer Maths Tutoring', body: 'A student applied. Review it from your organiser dashboard.',
      opportunity_id: OPP.tutoring, link: `/applications/${OPP.tutoring}`, dedupe_key: null, read_at: null, created_at: stamp(-1, 12) },
    { id: id(906), user_id: A.id, kind: 'report_update', title: 'Message reported', body: `A group message in ${marketTitle} needs review.`,
      opportunity_id: null, link: '/admin?tab=reports', dedupe_key: null, read_at: null, created_at: stamp(-1, 18) },
    { id: id(907), user_id: A.id, kind: 'privacy_request_update', title: 'New privacy request', body: 'A question request is waiting in the admin panel.',
      opportunity_id: null, link: '/admin?tab=privacy', dedupe_key: null, read_at: null, created_at: stamp(-3, 10) },
  ];
  const reports = [{
    id: id(1001), message_id: id(706), opportunity_id: OPP.market, activity_title: marketTitle, reporter_id: LEA.id,
    reporter_name: LEA.name, sender_id: NOAH.id, sender_name: NOAH.name, message_snapshot: 'lol nobody is going to buy your ugly labels',
    message_sent_at: stamp(-1, 17), reason: 'bullying', details: 'This was aimed at Mia in front of the whole group.',
    status: 'open', resolution_note: '', message_removed: false, resolved_by: null, resolver_name: '', resolved_at: null, created_at: stamp(-1, 18),
  }];
  const privacyRequests = [{
    id: id(1101), requester_id: EMMA.id, requester_name: EMMA.name, requester_email: EMMA.email, kind: 'question',
    details: 'Can teachers who are not running my activity see my reflections?', status: 'open', response: '',
    handled_by: null, handler_name: '', created_at: stamp(-3, 10), updated_at: stamp(-3, 10),
  }];

  return {
    profiles: [
      profile(S, 'student', '11', { bio: 'Grade 11 IB student who loves events and the outdoors.',
        interests: ['Environment', 'Events', 'Education'], skills: ['Teamwork', 'Design'], availability: ['Afternoons', 'Weekends'],
        preferred_categories: ['Sustainability & Environment', 'School-Based Service'], career_goals: ['Business'] }),
      profile(T, 'teacher', null), profile(A, 'admin', null),
      profile(NOAH, 'student', NOAH.grade), profile(LEA, 'student', LEA.grade), profile(SAM, 'student', SAM.grade),
      profile(EMMA, 'student', EMMA.grade), profile(JONAS, 'student', JONAS.grade),
      profile({ id: id(16), name: 'Oliver Graf', email: 'oliver.graf.demo@iszl.ch' }, 'student', null, { created_at: stamp(-1) }),
    ],
    opportunities, applications,
    saved_opportunities: [
      { id: id(1201), user_id: S.id, opportunity_id: OPP.lake, created_at: stamp(-3) },
      { id: id(1202), user_id: S.id, opportunity_id: OPP.food, created_at: stamp(-2) },
    ],
    activity_sessions: sessions, activity_announcements: announcements, activity_attendance: attendance,
    activity_hours: hours, activity_hour_reviews: hourReviews, activity_messages: messages,
    activity_reflections: reflections, notifications, message_reports: reports, privacy_requests: privacyRequests,
  };
}
