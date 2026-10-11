import type { PortfolioEntry } from '../services/portfolioService';

/** Quote every cell and neutralise spreadsheet formulas in untrusted text. */
export function csvCell(value: string | number): string {
  let safe = String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(safe) || /^[\t\r\n]/u.test(safe)) safe = `'${safe}`;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function portfolioCsv(entries: readonly PortfolioEntry[]): string {
  const headers = ['Activity', 'Category', 'Activity status', 'Service date', 'Submitted hours',
    'Review status', 'Approved credit hours', 'Description', 'Reviewer', 'Review date', 'Review note'];
  const rows = entries.map(entry => [
    entry.activityTitle, entry.activityCategory, entry.activityStatus, entry.date,
    entry.hours.toFixed(2), entry.status,
    (entry.status === 'approved' ? entry.hours : 0).toFixed(2),
    entry.description, entry.reviewerName, entry.reviewedAt ?? '', entry.reviewNote,
  ]);
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function downloadPortfolioCsv(entries: readonly PortfolioEntry[]): void {
  const blob = new Blob([portfolioCsv(entries)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `involv-my-service-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
