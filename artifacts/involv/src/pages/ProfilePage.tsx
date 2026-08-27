import { useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Category } from '../types';

const CATEGORIES: Category[] = [
  'Health & Wellbeing',
  'Education & Mentorship',
  'School-Based Service',
  'Community & Social Impact',
  'Global & Humanitarian',
  'Sustainability & Environment',
  'Arts, Culture & Media',
  'Technology & Innovation',
  'Business, Leadership & Management',
];

const INTEREST_OPTIONS = [
  'Computer Science', 'Mathematics', 'Biology', 'Chemistry', 'Physics',
  'Environmental science', 'Music', 'Visual art', 'Drama', 'Literature',
  'History', 'Economics', 'Psychology', 'Politics', 'Languages',
  'Photography', 'Film', 'Coding', 'Design',
];

const SKILL_OPTIONS = [
  'Communication', 'Leadership', 'Teamwork', 'Organisation', 'Creative writing',
  'Graphic design', 'Web development', 'Data analysis', 'Research', 'Public speaking',
  'Maths tutoring', 'Science tutoring', 'Photography', 'Video editing', 'Social media',
  'Empathy', 'Patience', 'Physical fitness', 'Foreign language',
];

const AVAILABILITY_OPTIONS = [
  'Weekday mornings (before school)',
  'Weekday lunchtimes',
  'Weekday afternoons (3–6 PM)',
  'Weekday evenings (after 6 PM)',
  'Saturday mornings',
  'Saturday afternoons',
  'Sunday mornings',
  'School holidays',
];

const GOAL_OPTIONS = [
  'Software engineering', 'Data science', 'Medicine', 'Law', 'Teaching',
  'Psychology', 'Social work', 'Architecture', 'Business/entrepreneurship',
  'Journalism', 'Film/media', 'Arts and design', 'Environmental science',
  'International relations', 'Public health', 'Nursing', 'Research',
];

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    name: user?.name ?? '',
    bio: user?.bio ?? '',
    grade: user?.grade ?? '',
    interests: user?.interests ?? [],
    careerGoals: user?.careerGoals ?? [],
    skills: user?.skills ?? [],
    availability: user?.availability ?? [],
    preferredCategories: user?.preferredCategories ?? [],
  });

  const toggle = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const handleSave = () => {
    updateUser({
      name: form.name,
      bio: form.bio,
      grade: form.grade,
      interests: form.interests,
      careerGoals: form.careerGoals,
      skills: form.skills,
      availability: form.availability,
      preferredCategories: form.preferredCategories,
    });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const profileFields = [
    !!form.bio, !!form.grade,
    form.interests.length > 0,
    form.careerGoals.length > 0,
    form.skills.length > 0,
    form.availability.length > 0,
  ];
  const profileComplete = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Profile & Preferences</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Your preferences help Involv recommend the most relevant opportunities.
              </p>
            </div>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn-secondary shrink-0">
                Edit profile
              </button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditing(false)} className="btn-ghost">Cancel</button>
                <button onClick={handleSave} className="btn-primary">Save changes</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-green-800">
            <CheckIcon size={15} />
            Profile saved successfully.
          </div>
        )}

        {/* Profile completeness */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-700">Profile completeness</p>
            <span className="text-xs font-bold text-blue-900">{profileComplete}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-blue-900 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${profileComplete}%` }}
            />
          </div>
          {profileComplete < 100 && (
            <p className="text-xs text-slate-500 mt-2">
              A more complete profile gets more relevant recommendations.
            </p>
          )}
        </div>

        {/* Basic info */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Basic information</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base">Full name</label>
              {editing ? (
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-base"
                />
              ) : (
                <p className="text-sm text-slate-900 mt-1">{user.name}</p>
              )}
            </div>
            <div>
              <label className="label-base">Year group</label>
              {editing ? (
                <select
                  value={form.grade}
                  onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                  className="input-base"
                >
                  <option value="">Not set</option>
                  <option>Grade 9</option>
                  <option>Grade 10</option>
                  <option>Grade 11</option>
                  <option>Grade 12</option>
                </select>
              ) : (
                <p className="text-sm text-slate-900 mt-1">{user.grade || '—'}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="label-base">Email</label>
              <p className="text-sm text-slate-900 mt-1">{user.email}</p>
              <p className="text-xs text-slate-400 mt-0.5">Linked to your school Google account. Cannot be changed here.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label-base">Short bio</label>
              {editing ? (
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="A sentence or two about yourself, your interests, and what drives you."
                  className="input-base resize-none"
                />
              ) : (
                <p className="text-sm text-slate-700 mt-1 leading-relaxed">{user.bio || '—'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Interests */}
        <div className="card p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Interests</h2>
          {editing ? (
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, interests: toggle(f.interests, opt) }))}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    form.interests.includes(opt)
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(user.interests?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">No interests added.</p>
              ) : (
                user.interests?.map(i => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5 font-medium">
                    {i}
                  </span>
                ))
              )}
            </div>
          )}
        </div>

        {/* Career goals */}
        <div className="card p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Career goals</h2>
          {editing ? (
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, careerGoals: toggle(f.careerGoals, opt) }))}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    form.careerGoals.includes(opt)
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(user.careerGoals?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">No goals added.</p>
              ) : (
                user.careerGoals?.map(g => (
                  <span key={g} className="text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5 font-medium">
                    {g}
                  </span>
                ))
              )}
            </div>
          )}
        </div>

        {/* Skills */}
        <div className="card p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Skills</h2>
          {editing ? (
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, skills: toggle(f.skills, opt) }))}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    form.skills.includes(opt)
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(user.skills?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">No skills added.</p>
              ) : (
                user.skills?.map(s => (
                  <span key={s} className="text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5 font-medium">
                    {s}
                  </span>
                ))
              )}
            </div>
          )}
        </div>

        {/* Availability */}
        <div className="card p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Availability</h2>
          {editing ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {AVAILABILITY_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.availability.includes(opt)}
                    onChange={() => setForm(f => ({ ...f, availability: toggle(f.availability, opt) }))}
                    className="w-3.5 h-3.5 rounded border-slate-300 accent-blue-900"
                  />
                  <span className="text-xs text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(user.availability?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">No availability added.</p>
              ) : (
                user.availability?.map(a => (
                  <span key={a} className="text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5 font-medium">
                    {a}
                  </span>
                ))
              )}
            </div>
          )}
        </div>

        {/* Preferred categories */}
        <div className="card p-6 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Preferred categories</h2>
            <p className="text-xs text-slate-500 mt-0.5">Used to personalise your dashboard recommendations.</p>
          </div>
          {editing ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <label key={cat} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.preferredCategories.includes(cat)}
                    onChange={() =>
                      setForm(f => ({ ...f, preferredCategories: toggle(f.preferredCategories, cat) }))
                    }
                    className="w-3.5 h-3.5 rounded border-slate-300 accent-blue-900"
                  />
                  <span className="text-xs text-slate-700">{cat}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(user.preferredCategories?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">No categories selected.</p>
              ) : (
                user.preferredCategories?.map(c => (
                  <span key={c} className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium">
                    {c}
                  </span>
                ))
              )}
            </div>
          )}
        </div>

        {editing && (
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary">Save changes</button>
          </div>
        )}
      </div>
    </div>
  );
}
