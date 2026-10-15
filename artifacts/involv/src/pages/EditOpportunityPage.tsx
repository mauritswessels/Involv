import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, CheckIcon, XCircleIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getOrganizerOpportunities, getOpportunityContact, updateOpportunity, setOpportunityStatus } from '../services/opportunityService';
import { actionError } from '../utils/actionError';
import type { Opportunity } from '../types';
import { logSafeError } from '../utils/safeConsole';

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

export default function EditOpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const [form, setForm] = useState({
    title: '',
    category: '',
    shortDescription: '',
    fullDescription: '',
    locationType: '',
    locationText: '',
    dates: '',
    timeCommitment: '',
    durationType: '',
    skillLevel: 'Beginner',
    impactType: 'Direct',
    skillsRequired: [] as string[],
    minGradeOrAge: '',
    positionsAvailable: '',
    applicationDeadline: '',
    startDate: '',
    skillsGained: [] as string[],
    impactDescription: '',
    organizerName: '',
    organizerRole: '',
    organizerEmail: '',
  });

  // Load the opportunity on mount
  useEffect(() => {
    if (!user || !id) return;
    getOrganizerOpportunities(user.id)
      .then(async opps => {
        const opp = opps.find(o => o.id === id) ?? null;
        if (opp) {
          const organizerEmail = await getOpportunityContact(id);
          setOpportunity(opp);
          setForm({
            title: opp.title,
            category: opp.category,
            shortDescription: opp.shortDescription,
            fullDescription: opp.fullDescription,
            locationType: opp.locationType,
            locationText: opp.locationText,
            dates: opp.dates,
            timeCommitment: opp.timeCommitment,
            durationType: opp.durationType,
            skillLevel: opp.skillLevel,
            impactType: opp.impactType,
            skillsRequired: opp.skillsRequired,
            minGradeOrAge: opp.minGradeOrAge,
            positionsAvailable: String(opp.positionsAvailable),
            applicationDeadline: opp.applicationDeadline,
            startDate: opp.startDate ?? '',
            skillsGained: opp.skillsGained,
            impactDescription: opp.impactDescription,
            organizerName: opp.organizerName,
            organizerRole: opp.organizerRole,
            organizerEmail,
          });
        }
      })
      .catch(err => { logSafeError('[Opportunity] failed to load for editing', err); setLoadError(actionError(err, 'load')); })
      .finally(() => setLoading(false));
  }, [user?.id, id]);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const toggleSkill = (skill: string, field: 'skillsRequired' | 'skillsGained') => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(skill)
        ? f[field].filter(s => s !== skill)
        : [...f[field], skill],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateOpportunity(id, {
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
        impactType: form.impactType,
        skillsRequired: form.skillsRequired,
        minGradeOrAge: form.minGradeOrAge,
        positionsAvailable: Number(form.positionsAvailable) || 1,
        applicationDeadline: form.applicationDeadline,
        startDate: form.startDate,
        skillsGained: form.skillsGained,
        impactDescription: form.impactDescription,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!id) return;
    setClosing(true);
    try {
      await setOpportunityStatus(id, 'closed');
      navigate('/organizer');
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to close listing.');
      setClosing(false);
      setConfirmClose(false);
    }
  };

  if (loadError) return <div role="alert" className="max-w-xl mx-auto p-6 text-sm text-red-800">
    <p>{loadError}</p><button type="button" onClick={() => window.location.reload()} className="btn-secondary mt-3">Retry loading</button>
  </div>;
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-sm text-slate-600 mb-4">Opportunity not found or you don't have permission to edit it.</p>
        <Link to="/organizer" className="btn-secondary">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
          <Link
            to="/organizer"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-3"
          >
            <ArrowLeftIcon size={13} />
            Back to dashboard
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Edit Opportunity</h1>
              <p className="text-sm text-slate-500 mt-0.5">Changes are saved immediately and visible to students.</p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmClose(true)}
              className="shrink-0 text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
            >
              Close listing
            </button>
          </div>
        </div>
      </div>

      {/* Success / error banners */}
      {saved && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-green-800">
            <CheckIcon size={15} />
            Changes saved successfully.
          </div>
        </div>
      )}
      {saveError && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {saveError}
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Section 1: Basic Information */}
        <div className="card p-6">
          <SectionHeader number="1" title="Basic information" description="The core details students will see first." />
          <div className="space-y-4">
            <div>
              <label className="label-base">Opportunity title *</label>
              <input type="text" required value={form.title} onChange={e => set('title', e.target.value)} className="input-base" />
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
              <textarea required rows={2} value={form.shortDescription} onChange={e => set('shortDescription', e.target.value)} className="input-base resize-none" />
              <p className="text-xs text-slate-400 mt-1">{form.shortDescription.length}/180 characters</p>
            </div>
            <div>
              <label className="label-base">Full description *</label>
              <textarea required rows={6} value={form.fullDescription} onChange={e => set('fullDescription', e.target.value)} className="input-base resize-none" />
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
              <input type="text" value={form.locationText} onChange={e => set('locationText', e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="label-base">Dates / schedule *</label>
              <input type="text" required value={form.dates} onChange={e => set('dates', e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="label-base">Time commitment *</label>
              <input type="text" required value={form.timeCommitment} onChange={e => set('timeCommitment', e.target.value)} className="input-base" />
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
              <input type="number" required min="1" value={form.positionsAvailable} onChange={e => set('positionsAvailable', e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="label-base">Application deadline *</label>
              <input type="date" required value={form.applicationDeadline} onChange={e => set('applicationDeadline', e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="label-base">Start date</label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className="input-base" />
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
              <label className="label-base">Impact type</label>
              <select value={form.impactType} onChange={e => set('impactType', e.target.value)} className="input-base">
                <option>Direct</option>
                <option>Indirect</option>
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
                <button key={skill} type="button" onClick={() => toggleSkill(skill, 'skillsRequired')}
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
        </div>

        {/* Section 4: Value */}
        <div className="card p-6">
          <SectionHeader number="4" title="Value for applicants" description="What will participants gain?" />
          <div className="space-y-4">
            <div>
              <label className="label-base mb-2">Skills applicants will gain</label>
              <div className="flex flex-wrap gap-2">
                {SKILLS_OPTIONS.map(skill => (
                  <button key={skill} type="button" onClick={() => toggleSkill(skill, 'skillsGained')}
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
              <textarea rows={2} value={form.impactDescription} onChange={e => set('impactDescription', e.target.value)} className="input-base resize-none" />
            </div>
          </div>
        </div>

        {/* Section 5: Organiser */}
        <div className="card p-6">
          <SectionHeader number="5" title="Organiser information" description="Students will see this on the detail page." />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base">Your name *</label>
              <input type="text" required value={form.organizerName} onChange={e => set('organizerName', e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="label-base">Your role / title *</label>
              <input type="text" required value={form.organizerRole} onChange={e => set('organizerRole', e.target.value)} className="input-base" />
            </div>
            <div className="sm:col-span-2">
              <label className="label-base">Contact email *</label>
              <input type="email" required value={form.organizerEmail} onChange={e => set('organizerEmail', e.target.value)} className="input-base" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <Link to="/organizer" className="btn-ghost">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Close listing confirmation dialog */}
      {confirmClose && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <XCircleIcon size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Close this listing?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Students will no longer be able to see or apply for{' '}
                  <span className="font-medium">{opportunity.title}</span>.
                  Existing applications are not affected.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmClose(false)} className="btn-ghost text-xs">
                Cancel
              </button>
              <button
                onClick={handleClose}
                disabled={closing}
                className="text-xs text-white bg-red-600 hover:bg-red-700 border border-red-600 rounded-lg px-4 py-2 transition-colors"
              >
                {closing ? 'Closing…' : 'Yes, close listing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
