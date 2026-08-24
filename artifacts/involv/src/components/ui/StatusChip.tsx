import type { ApplicationStatus } from '../../types';

const statusConfig: Record<ApplicationStatus, { label: string; className: string }> = {
  Pending: {
    label: 'Pending',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  'Under Review': {
    label: 'Under Review',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  Accepted: {
    label: 'Accepted',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  Rejected: {
    label: 'Not accepted',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

interface StatusChipProps {
  status: ApplicationStatus;
}

export function StatusChip({ status }: StatusChipProps) {
  const { label, className } = statusConfig[status];
  return (
    <span className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
