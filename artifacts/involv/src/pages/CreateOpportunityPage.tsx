import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createOpportunity } from '../services/opportunityService';
import { actionError } from '../utils/actionError';
import type { Opportunity, ServiceProgram, ServiceType } from '../types';

const CATEGORIES = [
  'Community & Social Impact',
  'Health & Wellbeing',
  'Sustainability & Environment',
  'Global & Humanitarian',
  'Arts, Culture & Media',
  'School-Based Service',
  'Business, Leadership & Management',
  'Technology & Innovation',
  'Education & Mentorship',
];

const SKILLS_OPTIONS = [
  'Communication', 'Leadership', 'Teamwork', 'Organisation', 'Creative writing',
  'Graphic design', 'Web development', 'Data analysis', 'Research', 'Public speaking',
  'Maths tutoring', 'Science tutoring', 'Photography', 'Video editing', 'Social media',
  'Empathy', 'Patience', 'Physical fitness', 'Foreign language',
];
const SERVICE_TYPES: ServiceType[] = ['Direct', 'Indirect', 'Advocacy', 'Research'];
const SERVICE_PROGRAMS: { value: ServiceProgram; label: string }[] = [
  { value: 'IB DP', label: 'IB Diploma Programme (IB DP)' },
  { value: 'HSP', label: 'High School Program (HSP)' },
];

function SectionHeader({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-7 h-7 rounded-lg bg-blue-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {number}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export default function CreateOpportunityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const duplicate = (location.state as { duplicate?: Opportunity } | null)?.duplicate;

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: duplicate ? `${duplicate.title} (Copy)` : '',
    category: duplicate?.category ?? '',
    shortDescription: duplicate?.shortDescription ?? '',
    fullDescription: duplicate?.fullDescription ?? '',
    locationType: duplicate?.locationType ?? '',
    locationText: duplicate?.locationText ?? '',
    dates: duplicate?.dates ?? '',
    timeCommitment: duplicate?.timeCommitment ?? '',
    durationType: duplicate?.durationType ?? '',
    skillLevel: duplicate?.skillLevel ?? 'Beginner',
    serviceType: duplicate?.serviceType ?? 'Direct',
    servicePrograms: duplicate?.servicePrograms ?? [] as ServiceProgram[],
    skillsRequired: duplicate?.skillsRequired ?? [] as string[],
    minGradeOrAge: duplicate?.minGradeOrAge ?? '',
    positionsAvailable: duplicate ? String(duplicate.positionsAvailable) : '',
    applicationDeadline: '',   // always clear — new listing, new deadline
    startDate: '',
    skillsGained: duplicate?.skillsGained ?? [] as string[],
    impactDescription: duplicate?.impactDescription ?? '',
    organizerName: duplicate?.organizerName ?? user?.name ?? '',
    organizerRole: duplicate?.organizerRole ?? '',
    organizerEmail: duplicate?.organizerEmail || user?.email || '',
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const toggleSkill = (skill: string, field: 'skillsRequired' | 'skillsGained') => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(skill)
        ? f[field].filter(s => s !== skill)
        : [...f[field], skill],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createOpportunity(user.id, {
        title: form.title,
        category: form.category,
        shortDescription: form.shortDescription,
        fullDescription: form.fullDescription,
        organizerName: form.organizerName,
        organizerRole: form.organizerRole,
        organizerEmail: form.organizerEmail,
        locationType: form.locationType,
        locationText: form.locationText,
        dates: form.dates,
        timeCommitment: form.timeCommitment,
        durationType: form.durationType,
        skillLevel: form.skillLevel,
        serviceType: form.serviceType,
        servicePrograms: form.servicePrograms,
        skillsRequired: form.skillsRequired,
        minGradeOrAge: form.minGradeOrAge,
        positionsAvailable: Number(form.positionsAvailable) || 1,
        applicationDeadline: form.applicationDeadline,
        startDate: form.startDate,
        skillsGained: form.skillsGained,
        impactDescription: form.impactDescription,
        tags: [],
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setSaveError(actionError(err, 'listing'));
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-4">
            <CheckIcon size={24} className="text-green-700" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 mb-2">Opportunity posted</h2>
          <p className="text-sm text-slate-600 mb-1">
            <span className="font-medium">{form.title}</span> is now live on Involv.
          </p>
          <p className="text-xs text-slate-500 mb-6">
            Students can browse, save, and apply. You'll receive applications in your dashboard.
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={() => navigate('/organizer')} className="btn-primary w-full justify-center">
              Go to my dashboard
            </button>
            <button onClick={() => { setSubmitted(false); setForm(f => ({ ...f, title: '', shortDescription: '', fullDescription: '' })); }} className="btn-secondary w-full justify-center">
              Post another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
          <h1 className="text-xl font-bold text-slate-900">Post an Opportunity</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Fill in the details below. Students will see this on the Browse page.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Section 1: Basic Information */}
        <div className="card p-6">
          <SectionHeader number="1" title="Basic information" description="The core details students will see first." />
          <div className="space-y-4">
            <div>
              <label className="label-base">Opportunity title *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. Peer Tutoring Programme — Maths & Sciences"
                className="input-base"
              />
            </div>
            <div>
              <label className="label-base">Category *</label>
              <select required value={form.category} onChange={e => set('category', e.target.value)} className="input-base">
                <option value="">Select a category…</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">Short description *</label>
              <textarea
                required
                rows={2}
                value={form.shortDescription}
                onChange={e => set('shortDescription', e.target.value)}
                placeholder="One or two sentences for the browse card. Be specific."
                className="input-base resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">{form.shortDescription.length}/180 characters</p>
            </div>
            <div>
              <label className="label-base">Full description *</label>
              <textarea
                required
                rows={6}
                value={form.fullDescription}
                onChange={e => set('fullDescription', e.target.value)}
                placeholder="Describe the opportunity in full. Include context, what volunteers will do, what to expect, and why it matters."
                className="input-base resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Logistics */}
        <div className="card p-6">
          <SectionHeader number="2" title="Logistics" description="When, where, and how long." />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base">Location type *</label>
              <select required value={form.locationType} onChange={e => set('locationType', e.target.value)} className="input-base">
                <option value="">Select…</option>
                <option>On-campus</option>
                <option>Off-campus</option>
                <option>Remote</option>
              </select>
            </div>
            <div>
              <label className="label-base">Location details</label>
              <input
                type="text"
                value={form.locationText}
                onChange={e => set('locationText', e.target.value)}
                placeholder="e.g. School Library, Room 12"
                className="input-base"
              />
            </div>
            <div>
              <label className="label-base">Dates / schedule *</label>
              <input
                type="text"
                required
                value={form.dates}
                onChange={e => set('dates', e.target.value)}
                placeholder="e.g. Every Tuesday, 3:30–5:00 PM"
                className="input-base"
              />
            </div>
            <div>
              <label className="label-base">Time commitment *</label>
              <input
                type="text"
                required
                value={form.timeCommitment}
                onChange={e => set('timeCommitment', e.target.value)}
                placeholder="e.g. 3 hours/week"
                className="input-base"
              />
            </div>
            <div>
              <label className="label-base">Duration type *</label>
              <select required value={form.durationType} onChange={e => set('durationType', e.target.value)} className="input-base">
                <option value="">Select…</option>
                <option>One-time</option>
                <option>Ongoing</option>
                <option>Fixed period</option>
              </select>
            </div>
            <div>
              <label className="label-base">Positions available *</label>
              <input
                type="number"
                required
                min="1"
                value={form.positionsAvailable}
                onChange={e => set('positionsAvailable', e.target.value)}
                placeholder="e.g. 10"
                className="input-base"
              />
            </div>
            <div>
              <label className="label-base">Application deadline *</label>
              <input
                type="date"
                required
                value={form.applicationDeadline}
                onChange={e => set('applicationDeadline', e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="label-base">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => set('startDate', e.target.value)}
                className="input-base"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Requirements */}
        <div className="card p-6">
          <SectionHeader number="3" title="Requirements" description="Who is this opportunity for?" />
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label-base">Skill level required</label>
              <select value={form.skillLevel} onChange={e => set('skillLevel', e.target.value)} className="input-base">
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
            <div>
              <label className="label-base">Service type *</label>
              <select required value={form.serviceType} onChange={e => set('serviceType', e.target.value)} className="input-base">
                {SERVICE_TYPES.map(type => <option key={type} value={type}>{type} service</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">Minimum year group</label>
              <select value={form.minGradeOrAge} onChange={e => set('minGradeOrAge', e.target.value)} className="input-base">
                <option value="">No minimum</option>
                <option>Grade 9</option>
                <option>Grade 10</option>
                <option>Grade 11</option>
                <option>Grade 12</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label-base mb-2">Skills expected from applicants</label>
            <div className="flex flex-wrap gap-2">
              {SKILLS_OPTIONS.map(skill => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill, 'skillsRequired')}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    form.skillsRequired.includes(skill)
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <p className="label-base mb-2">Programmes this activity is approved to count toward</p>
            <p className="text-xs text-slate-500 mb-3">Select only programmes confirmed by the school. Students can filter by these labels.</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {SERVICE_PROGRAMS.map(program => (
                <label key={program.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.servicePrograms.includes(program.value)}
                    onChange={() => setForm(f => ({
                      ...f,
                      servicePrograms: f.servicePrograms.includes(program.value)
                        ? f.servicePrograms.filter(value => value !== program.value)
                        : [...f.servicePrograms, program.value],
                    }))}
                    className="rounded border-slate-300 text-blue-900 focus:ring-blue-900/20 accent-blue-900"
                  />
                  {program.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Section 4: Application details */}
        <div className="card p-6">
          <SectionHeader number="4" title="Value for applicants" description="What will participants gain? This appears on the detail page." />
          <div className="space-y-4">
            <div>
              <label className="label-base mb-2">Skills applicants will gain</label>
              <div className="flex flex-wrap gap-2">
                {SKILLS_OPTIONS.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill, 'skillsGained')}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.skillsGained.includes(skill)
                        ? 'bg-blue-900 text-white border-blue-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label-base">Impact description</label>
              <textarea
                rows={2}
                value={form.impactDescription}
                onChange={e => set('impactDescription', e.target.value)}
                placeholder="Describe the real-world impact of this opportunity with specific numbers or outcomes if possible."
                className="input-base resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Organiser */}
        <div className="card p-6">
          <SectionHeader number="5" title="Organiser information" description="Students will see this on the detail page." />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base">Your name *</label>
              <input
                type="text"
                required
                value={form.organizerName}
                onChange={e => set('organizerName', e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="label-base">Your role / title *</label>
              <input
                type="text"
                required
                value={form.organizerRole}
                onChange={e => set('organizerRole', e.target.value)}
                placeholder="e.g. Environmental Club Advisor"
                className="input-base"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-base">Contact email *</label>
              <input
                type="email"
                required
                value={form.organizerEmail}
                onChange={e => set('organizerEmail', e.target.value)}
                className="input-base"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="space-y-3">
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Fields marked * are required. You can edit the listing after posting.
            </p>
            <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5">
              {saving ? 'Posting…' : 'Post opportunity'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
