export function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) {
    return null;
  }
  const target = new Date(dateIso);
  if (isNaN(target.getTime())) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Human label for how soon an internship starts, e.g. "Starts in 12d". */
export function startCountdown(startDate: string | null): string | null {
  const days = daysUntil(startDate);
  if (days === null) {
    return null;
  }
  if (days > 1) return `Starts in ${days}d`;
  if (days === 1) return 'Starts tomorrow';
  if (days === 0) return 'Starts today';
  return 'Already started';
}

/** Human label for an application deadline, e.g. "Closes in 5d". */
export function deadlineCountdown(deadline: string | null): string | null {
  const days = daysUntil(deadline);
  if (days === null) {
    return null;
  }
  if (days < 0) return 'Closed';
  if (days === 0) return 'Closes today';
  if (days === 1) return 'Closes tomorrow';
  return `Closes in ${days}d`;
}

export function formatDate(dateIso: string | null): string {
  if (!dateIso) {
    return '—';
  }
  const date = new Date(dateIso);
  return isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Compact "2h ago" / "3d ago" style stamp for notification feeds. */
export function relativeTime(dateIso: string | null): string {
  if (!dateIso) {
    return '';
  }
  const date = new Date(dateIso);
  if (isNaN(date.getTime())) {
    return '';
  }
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateIso);
}

export const TYPE_LABELS: Record<string, string> = {
  Internship: 'Internship',
  PartTime: 'Part-time',
  FullTime: 'Full-time',
};
