import { useRef, useState } from 'react';
import { actionError } from '../../utils/actionError';
import { XIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { Opportunity } from '../../types';

interface ApplicationModalProps {
  opportunity: Opportunity;
  onClose: () => void;
}

const grades = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

export default function ApplicationModal({ opportunity, onClose }: ApplicationModalProps) {
  const { submitApplication } = useApp();
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const sending = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({
    grade: user?.grade ?? 'Grade 11',
    motivation: '',
    relevantExperience: '',
    availability: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.motivation.trim()) e.motivation = 'Please tell us your motivation.';
    if (form.motivation.trim().length < 30) e.motivation = 'Please write at least a sentence or two.';
    if (!form.availability.trim()) e.availability = 'Please confirm your availability.';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending.current) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    sending.current = true; setSubmitting(true);
    setSubmitError(null);

    try {
      await submitApplication({
        opportunityId: opportunity.id,
        opportunityTitle: opportunity.title,
        applicantId: user?.id ?? '',
        applicantName: user?.name ?? 'Student',
        applicantEmail: user?.email ?? '',
        organizerId: opportunity.organizerId ?? null,
        grade: form.grade,
        motivation: form.motivation,
        relevantExperience: form.relevantExperience,
        availability: form.availability,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setSubmitError(actionError(err, 'apply'));
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Application submitted</h3>
          <p className="text-sm text-slate-600 mb-1">
            Your application for <span className="font-medium">{opportunity.title}</span> has been sent.
          </p>
          <p className="text-xs text-slate-500 mb-6">
            {opportunity.organizerName} will review your application and get back to you.
          </p>
          <button onClick={onClose} className="btn-primary w-full justify-center">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Apply for opportunity</h2>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{opportunity.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close"
          >
            <XIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
          <div>
            <label htmlFor="grade" className="label-base">Year group</label>
            <select
              id="grade"
              value={form.grade}
              onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
              className="input-base h-9 py-0"
            >
              {grades.map(g => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="motivation" className="label-base">
              Why do you want to join this opportunity?{' '}
              <span className="text-slate-400 font-normal">*</span>
            </label>
            <textarea
              id="motivation"
              rows={4}
              value={form.motivation}
              onChange={e => {
                setForm(f => ({ ...f, motivation: e.target.value }));
                if (errors.motivation) setErrors(e => ({ ...e, motivation: '' }));
              }}
              placeholder="Tell the organiser what draws you to this and what you hope to contribute."
              className={`input-base resize-none ${errors.motivation ? 'border-red-400 focus:border-red-400' : ''}`}
            />
            {errors.motivation && (
              <p className="text-xs text-red-600 mt-1">{errors.motivation}</p>
            )}
          </div>

          <div>
            <label htmlFor="experience" className="label-base">
              Relevant experience{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="experience"
              rows={3}
              value={form.relevantExperience}
              onChange={e => setForm(f => ({ ...f, relevantExperience: e.target.value }))}
              placeholder="Any relevant skills, past roles, or experiences — however informal."
              className="input-base resize-none"
            />
          </div>

          <div>
            <label htmlFor="availability" className="label-base">
              Confirm your availability{' '}
              <span className="text-slate-400 font-normal">*</span>
            </label>
            <textarea
              id="availability"
              rows={2}
              value={form.availability}
              onChange={e => {
                setForm(f => ({ ...f, availability: e.target.value }));
                if (errors.availability) setErrors(e => ({ ...e, availability: '' }));
              }}
              placeholder={`This opportunity requires: ${opportunity.timeCommitment}. Confirm this works for you.`}
              className={`input-base resize-none ${errors.availability ? 'border-red-400 focus:border-red-400' : ''}`}
            />
            {errors.availability && (
              <p className="text-xs text-red-600 mt-1">{errors.availability}</p>
            )}
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
              {submitError}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
            <span className="font-medium text-slate-900">Before applying:</span> make sure you can
            commit to <strong>{opportunity.timeCommitment}</strong>. Consistent attendance matters to
            the organiser and the people they serve.
          </div>
        </form>

        <div className="p-5 border-t border-slate-200 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
      </div>
    </div>
  );
}
