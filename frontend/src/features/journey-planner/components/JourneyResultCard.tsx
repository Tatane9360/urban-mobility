import { NavigationArrow } from '@phosphor-icons/react/dist/ssr';
import { SegmentBadge } from './SegmentBadge';
import { CarbonBadge } from './CarbonBadge';
import type { Journey } from '../types';

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours} h ${remainder} min` : `${minutes} min`;
}

interface JourneyResultCardProps {
  journey: Journey;
  onStartNavigation: () => void;
}

export function JourneyResultCard({ journey, onStartNavigation }: JourneyResultCardProps) {
  return (
    <div className="w-full rounded-lg border border-accent bg-accent/5 p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {formatDuration(journey.durationSeconds)}
        </span>
        <CarbonBadge carbonGrams={journey.carbonGrams} carComparison={journey.carComparison} />
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {journey.segments.map((segment, index) => (
          <SegmentBadge key={`${segment.mode}-${index}`} segment={segment} />
        ))}
      </div>

      <button
        type="button"
        onClick={onStartNavigation}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
      >
        <NavigationArrow size={16} weight="bold" />
        Démarrer l&apos;itinéraire
      </button>
    </div>
  );
}
