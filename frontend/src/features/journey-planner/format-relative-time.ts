const relativeTimeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

// "il y a X min" for a past ISO timestamp, e.g. a GBFS snapshot's fetchedAt.
export function formatRelativeTime(isoString: string, now: Date = new Date()): string {
  const minutes = Math.round((new Date(isoString).getTime() - now.getTime()) / 60_000);
  if (minutes > -1) return "à l'instant";
  return relativeTimeFormat.format(minutes, 'minute');
}
