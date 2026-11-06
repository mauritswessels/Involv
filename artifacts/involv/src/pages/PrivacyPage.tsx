import { Link } from 'react-router-dom';
import { ShieldCheckIcon } from 'lucide-react';

/**
 * Everything the school still has to decide lives here. Fill these in once ISZL
 * answers the data-protection questions, then set `approvedBySchool` to true.
 * Until then the page shows a "draft" banner and the pending wording below.
 */
export const PRIVACY_CONFIG = {
  approvedBySchool: false,
  /** Legal operator / controller, e.g. "International School of Zug and Luzern (ISZL)". */
  operator: '',
  /** Privacy contact shown to students and parents, e.g. a school privacy-office address. */
  privacyContact: '',
  /** Where the website is hosted, e.g. "Vercel Inc." or "Replit, Inc.". */
  hostingProvider: '',
  /** Supabase project region, e.g. "EU (Frankfurt)". Check Supabase → Project Settings. */
  databaseRegion: '',
  /** Approved retention wording per category; leave empty until the school decides. */
  retention: {
    approvedHours: '',
    otherRecords: '',
    afterLeaving: '',
  },
  /** Student/parent information or permission process approved by the school. */
  parentInformation: '',
  effectiveDate: '',
  lastReviewed: '6 November 2026',
};

const PENDING = 'Being confirmed with ISZL';

function Pending({ value, fallback = PENDING }: { value: string; fallback?: string }) {
  return value
    ? <>{value}</>
    : <span className="inline-block rounded bg-amber-50 border border-amber-200 text-amber-800 px-1.5 text-[0.8em] font-medium">{fallback}</span>;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold text-slate-900 mb-2">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

const WHO_SEES: { what: string; who: string }[] = [
  { what: 'Your profile (grade, bio, interests, goals, skills, availability)', who: 'You and school admins' },
  { what: 'Applications you submit (name, email, grade, motivation, experience, availability)', who: 'You, the organiser of that activity and school admins' },
  { what: 'Saved opportunities', who: 'Only you' },
  { what: 'Your name in an activity group', who: 'Accepted members of that group, its organiser and school admins' },
  { what: 'Group messages', who: 'Current members of that group, its organiser and school admins' },
  { what: 'Attendance and service hours', who: 'You, the organiser of that activity and school admins' },
  { what: 'Reflections', who: 'You, the organiser of that activity and school admins (never other students)' },
  { what: 'Notifications', who: 'Only you' },
  { what: 'Reports about a message', who: 'You (as the reporter) and school admins' },
  { what: 'Published opportunity listings', who: 'Anyone, including people who are not signed in. Organiser email addresses are never public' },
];

export default function PrivacyPage() {
  const c = PRIVACY_CONFIG;
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-blue-900">
            <ShieldCheckIcon size={20} />
            <span className="text-xs font-semibold uppercase tracking-wide">Privacy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">How Involv uses your information</h1>
          <p className="text-sm text-slate-600">
            Involv helps ISZL students find, apply for and keep a record of service-learning and CAS
            opportunities, and helps approved teachers and organisers run them. This page explains what
            information Involv stores, who can see it and what you can do about it.
          </p>
          {!c.approvedBySchool && (
            <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Draft for school review.</strong> The parts marked “{PENDING}” are waiting for ISZL's
              decision. Involv is not yet open to students.
            </div>
          )}
          <p className="text-xs text-slate-500">
            Effective date: <Pending value={c.effectiveDate} fallback="Not yet in effect" /> · Last reviewed: {c.lastReviewed}
          </p>
        </header>

        <div className="card p-6 sm:p-8 space-y-8">
          <Section id="who" title="Who runs Involv">
            <p>
              Involv was built by ISZL students Maurits Wessels and Florence Hesselbach. The organisation
              responsible for deciding how information in Involv is used is: <Pending value={c.operator} />.
            </p>
            <p>Privacy questions and requests: <Pending value={c.privacyContact} />.</p>
          </Section>

          <Section id="what" title="What information Involv stores">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Sign-in details</strong> from your ISZL Google account: your account ID, name and school email address. Only verified @iszl.ch accounts can sign in.</li>
              <li><strong>Profile details you choose to add</strong>: grade, short bio, interests, goals, skills, availability and preferred categories.</li>
              <li><strong>Applications</strong>: the activity, your name, email and grade, what you write about your motivation, experience and availability, and the application's status.</li>
              <li><strong>Activity records</strong> once you are accepted: attendance, service hours you submit and how they were reviewed, group messages you send, and reflections you write.</li>
              <li><strong>Saved opportunities</strong> and <strong>notifications</strong> about your applications, activities and deadlines.</li>
              <li><strong>Reports and requests</strong>: if you report a message or make a privacy request, what you wrote and how it was handled.</li>
              <li><strong>Technical records</strong> that the hosting and database providers keep to run and protect the service, such as request and error logs. Involv does not deliberately log what you write in applications, messages or reflections.</li>
            </ul>
            <p>
              Please don't put sensitive information (such as health details) in your profile, applications,
              messages or reflections unless a staff member specifically asks for it.
            </p>
          </Section>

          <Section id="why" title="Why it is used">
            <p>
              Only to run Involv: showing opportunities, letting you apply, letting organisers review
              applications and run their activity, recording approved service hours, and sending you
              notifications inside Involv. Involv has no advertising, does not sell information and does
              not use tracking or analytics cookies. Your browser stores a sign-in session so you stay
              logged in; signing out removes it.
            </p>
          </Section>

          <Section id="access" title="Who can see what">
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2 font-semibold">Information</th>
                    <th className="px-2 py-2 font-semibold">Who can see it</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {WHO_SEES.map(row => (
                    <tr key={row.what}>
                      <td className="px-2 py-2 align-top text-slate-800">{row.what}</td>
                      <td className="px-2 py-2 align-top text-slate-600">{row.who}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              These rules are enforced by the database itself, not just by the website. New accounts always
              start as students; only a school admin can make someone a teacher, organiser or admin.
            </p>
          </Section>

          <Section id="providers" title="Service providers">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Supabase</strong> stores the database and handles sign-in. Region: <Pending value={c.databaseRegion} />.</li>
              <li><strong>Google</strong> confirms your ISZL account when you sign in. Involv only receives your basic account details, not your email, Drive or other Google data.</li>
              <li><strong>Website hosting</strong>: <Pending value={c.hostingProvider} />.</li>
            </ul>
          </Section>

          <Section id="retention" title="How long information is kept">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Approved service hours: <Pending value={c.retention.approvedHours} />.</li>
              <li>Other records (profile, applications, messages, reflections): <Pending value={c.retention.otherRecords} />.</li>
              <li>When you leave ISZL or close your account: <Pending value={c.retention.afterLeaving} />.</li>
              <li>Notifications you have read are deleted automatically after 90 days.</li>
            </ul>
          </Section>

          <Section id="rights" title="Your choices">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>See and download your information</strong>: go to <Link to="/profile#your-data" className="text-blue-900 underline">Profile → Your data</Link> and choose “Download my data”.</li>
              <li><strong>Correct it</strong>: edit your profile at any time, or ask for a correction from Profile → Your data.</li>
              <li><strong>Delete things</strong>: you can delete your own reflections, remove your own messages, unsave listings and withdraw pending applications yourself. To ask for your account and records to be deleted, use Profile → Your data. The school handles these requests under its retention rules.</li>
              <li><strong>Report a problem</strong>: use “Report” on any group message that worries you. A school admin reviews every report. If you feel unsafe, speak to a teacher or counsellor straight away.</li>
            </ul>
          </Section>

          <Section id="students" title="Students under 18 and parents">
            <p>
              How students and parents are informed, and whether permission is needed: <Pending value={c.parentInformation} />.
              Some activities may also need separate permission from the school or the organiser.
            </p>
          </Section>

          <Section id="changes" title="Changes to this page">
            <p>
              If Involv starts using information in a new way, this page will be updated and reviewed by the
              school first. The date at the top shows when it last changed.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
