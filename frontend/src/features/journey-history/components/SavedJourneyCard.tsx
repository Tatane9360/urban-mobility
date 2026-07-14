import { Leaf, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { SegmentBadge } from '../../journey-planner/components/SegmentBadge';
import type { SavedJourney } from '../types';

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours} h ${remainder} min` : `${minutes} min`;
}

function formatGrams(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function SavedJourneyCard({ journey }: { journey: SavedJourney }) {
  const first = journey.segments[0];
  const last = journey.segments[journey.segments.length - 1];
  // Walk segments touching a raw geocoded point (not a matched transit stop)
  // carry an empty waypoint name — see JourneyWaypoint's "tracé" comment.
  const showRoute = first?.from.name && last?.to.name;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatDuration(journey.durationSeconds)}
          </span>
          {showRoute && (
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              {first.from.name} → {last.to.name}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatDate(journey.savedAt)}</span>
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <Leaf size={14} />
            <span>{formatGrams(journey.carbonGrams)} CO₂e</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {journey.segments.map((segment, index) => (
          <SegmentBadge key={`${segment.mode}-${index}`} segment={segment} />
        ))}
      </div>

      {journey.degraded && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          <WarningCircle size={14} />
          <span>Horaires théoriques (temps réel indisponible)</span>
        </div>
      )}
    </div>
  );
}
