import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, ArrowRightIcon, ArrowLeftIcon, SparklesIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Category } from '../types';

type Step = 'interests' | 'skills' | 'availability' | 'details';
const STEPS: Step[] = ['interests', 'skills', 'availability', 'details'];

const CATEGORIES: Category[] = [
  'Sustainability & Environment',
  'Community & Social Impact',
  'Health & Wellbeing',
  'Education & Mentorship',
  'Arts, Culture & Media',
  'Technology & Innovation',
  'Business, Leadership & Management',
  'Global & Humanitarian',
  'School-Based Service',
];

const CATEGORY_ICONS: Record<string, string> = {
  'Sustainability & Environment': '🌿',
  'Community & Social Impact': '🤝',
  'Education & Mentorship': '📚',
  'Health & Wellbeing': '💚',
  'Arts, Culture & Media': '🎨',
  'Technology & Innovation': '💻',
  'Business, Leadership & Management': '📈',
  'Global & Humanitarian': '🌍',
  'School-Based Service': '⭐',
};

const SUGGESTED_SKILLS = [
  'Communication', 'Leadership', 'Teamwork', 'Problem solving', 'Research',
  'Public speaking', 'Writing', 'Design', 'Coding', 'Event planning',
  'Fundraising', 'Teaching', 'Languages', 'Photography', 'Social media',
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMES = ['Before school', 'Lunch time', 'After school', 'Evenings', 'Weekends'];

const GRADES = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'];

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
        active
          ? 'border-blue-900 bg-blue-50 text-blue-900'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {active && <CheckIcon size={12} className="shrink-0" />}
      {children}
    </button>
  );
}

const STEP_INFO: Record<Step, { title: string; subtitle: string }> = {
  interests: { title: 'What areas interest you?', subtitle: 'Select all that apply — we\'ll use this to surface relevant opportunities.' },
  skills: { title: 'What are your skills?', subtitle: 'Add skills you have or want to develop through service learning.' },
  availability: { title: 'When are you available?', subtitle: 'Select the times you\'re generally free for activities.' },
  details: { title: 'A few final details', subtitle: 'Help organisers understand your background.' },
};

export default function OnboardingPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const [interests, setInterests] = useState<Category[]>(user?.preferredCategories ?? []);
  const [skills, setSkills] = useState<string[]>(user?.skills ?? []);
  const [skillInput, setSkillInput] = useState('');
  const [availability, setAvailability] = useState<string[]>(user?.availability ?? []);
  const [grade, setGrade] = useState(user?.grade ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');

  const step = STEPS[stepIdx];
  const info = STEP_INFO[step];
  const isLast = stepIdx === STEPS.length - 1;

  const addSkill = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills(prev => [...prev, trimmed]);
    setSkillInput('');
  };

  const removeSkill = (s: string) => setSkills(prev => prev.filter(x => x !== s));

  const canAdvance = () => {
    if (step === 'interests') return interests.length > 0;
    if (step === 'skills') return true;
    if (step === 'availability') return availability.length > 0;
    return true;
  };

  const finish = async () => {
    setSaving(true);
    try {
      await updateUser({
        preferredCategories: interests,
        skills,
        availability,
        grade: grade || undefined,
        bio: bio || undefined,
        onboardingComplete: true,
      });
      navigate('/dashboard', { replace: true });
    } catch {
      setSaving(false);
    }
  };

  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <img src="/logo.png" alt="Involv" className="h-7 w-auto" />
          <button
            onClick={() => { updateUser({ onboardingComplete: true }); navigate('/dashboard', { replace: true }); }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 h-0.5">
        <div className="bg-blue-900 h-0.5 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < stepIdx ? 'bg-blue-900 text-white' :
                  i === stepIdx ? 'bg-blue-900 text-white ring-4 ring-blue-100' :
                  'bg-slate-200 text-slate-400'
                }`}>
                  {i < stepIdx ? <CheckIcon size={12} /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 ${i < stepIdx ? 'bg-blue-900' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>

          <div className="text-center mb-8">
            <h1 className="text-xl font-bold text-slate-900 mb-1.5">{info.title}</h1>
            <p className="text-sm text-slate-500 leading-relaxed">{info.subtitle}</p>
          </div>

          <div className="card p-6 mb-6">
            {/* ── Interests ── */}
            {step === 'interests' && (
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <Toggle
                    key={cat}
                    active={interests.includes(cat)}
                    onClick={() => setInterests(prev =>
                      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                    )}
                  >
                    <span>{CATEGORY_ICONS[cat]}</span> {cat}
                  </Toggle>
                ))}
              </div>
            )}

            {/* ── Skills ── */}
            {step === 'skills' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSkill(skillInput)}
                    placeholder="Type a skill and press Enter…"
                    className="input-base flex-1"
                  />
                  <button
                    onClick={() => addSkill(skillInput)}
                    disabled={!skillInput.trim()}
                    className="btn-primary disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>

                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {skills.map(s => (
                      <span key={s} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg px-2.5 py-1 text-sm font-medium">
                        {s}
                        <button onClick={() => removeSkill(s)} className="text-blue-400 hover:text-blue-700 transition-colors">
                          <CheckIcon size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_SKILLS.filter(s => !skills.includes(s)).map(s => (
                      <button
                        key={s}
                        onClick={() => setSkills(prev => [...prev, s])}
                        className="px-2.5 py-1 text-xs border border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-900 hover:text-blue-900 hover:bg-blue-50 transition-colors"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Availability ── */}
            {step === 'availability' && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2.5">Days</p>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                      <Toggle
                        key={day}
                        active={availability.includes(day)}
                        onClick={() => setAvailability(prev =>
                          prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                        )}
                      >
                        {day}
                      </Toggle>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2.5">Times</p>
                  <div className="flex flex-wrap gap-2">
                    {TIMES.map(t => (
                      <Toggle
                        key={t}
                        active={availability.includes(t)}
                        onClick={() => setAvailability(prev =>
                          prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                        )}
                      >
                        {t}
                      </Toggle>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Details ── */}
            {step === 'details' && (
              <div className="space-y-4">
                <div>
                  <label className="label-base">Year group</label>
                  <div className="flex flex-wrap gap-2">
                    {GRADES.map(g => (
                      <Toggle key={g} active={grade === g} onClick={() => setGrade(grade === g ? '' : g)}>
                        {g}
                      </Toggle>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label-base">Brief bio <span className="text-slate-400 font-normal">(optional)</span></label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Tell organisers a bit about yourself — your interests, what you hope to gain, etc."
                    rows={4}
                    className="input-base resize-none leading-relaxed"
                  />
                  <p className="text-xs text-slate-400 mt-1">{bio.length} characters</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStepIdx(i => i - 1)}
              disabled={stepIdx === 0}
              className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed gap-1.5"
            >
              <ArrowLeftIcon size={14} /> Back
            </button>

            {isLast ? (
              <button
                onClick={finish}
                disabled={saving}
                className="btn-primary gap-2 px-6"
              >
                <SparklesIcon size={14} />
                {saving ? 'Saving…' : 'Complete setup'}
              </button>
            ) : (
              <button
                onClick={() => setStepIdx(i => i + 1)}
                disabled={!canAdvance()}
                className="btn-primary gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue <ArrowRightIcon size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
