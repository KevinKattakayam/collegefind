export const NOT_AVAILABLE = 'Not available';

export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return NOT_AVAILABLE;
  return '₹' + amount.toLocaleString('en-IN');
}

export function formatLPA(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return NOT_AVAILABLE;
  return '₹' + amount.toFixed(2) + ' LPA';
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return `${value}%`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return value.toLocaleString('en-IN');
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function timeAgo(date: string, now: Date = new Date()): string {
  const d = new Date(date);
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function getExamLabel(exam: string): string {
  const labels: Record<string, string> = {
    JEE_MAIN: 'JEE Main',
    JEE_ADVANCED: 'JEE Advanced',
    NEET: 'NEET UG',
    CAT: 'CAT',
    GATE: 'GATE',
  };
  return labels[exam] || exam;
}

export function getCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    OPEN: 'General (OPEN)',
    EWS: 'EWS',
    OBC_NCL: 'OBC (Non-Creamy Layer)',
    SC: 'SC',
    ST: 'ST',
  };
  return labels[cat] || cat;
}

export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '…';
}
