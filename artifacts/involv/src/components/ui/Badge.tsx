import type { Category } from '../../types';

const categoryStyles: Record<Category, string> = {
  'Sustainability & Environment': 'bg-green-50 text-green-700 border-green-200',
  'Community & Social Impact': 'bg-sky-50 text-sky-700 border-sky-200',
  'Education & Mentorship': 'bg-violet-50 text-violet-700 border-violet-200',
  'Health & Wellbeing': 'bg-teal-50 text-teal-700 border-teal-200',
  'Arts, Culture & Media': 'bg-orange-50 text-orange-700 border-orange-200',
  'Technology & Innovation': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Business, Leadership & Management': 'bg-slate-100 text-slate-700 border-slate-200',
  'Global & Humanitarian': 'bg-red-50 text-red-700 border-red-200',
  'School-Based Service': 'bg-amber-50 text-amber-700 border-amber-200',
};

interface CategoryBadgeProps {
  category: Category;
  size?: 'sm' | 'md';
}

export function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  const base = 'inline-flex items-center border rounded-md font-medium leading-none';
  const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`${base} ${sizeClass} ${categoryStyles[category]}`}>
      {category}
    </span>
  );
}

interface TagBadgeProps {
  label: string;
}

export function TagBadge({ label }: TagBadgeProps) {
  return (
    <span className="inline-flex items-center bg-slate-100 text-slate-600 border border-slate-200 rounded-md px-2 py-0.5 text-xs font-medium">
      {label}
    </span>
  );
}

interface PillProps {
  label: string;
  variant?: 'default' | 'blue';
}

export function Pill({ label, variant = 'default' }: PillProps) {
  const styles =
    variant === 'blue'
      ? 'bg-blue-50 text-blue-800 border-blue-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}
