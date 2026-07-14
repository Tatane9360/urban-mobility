import { JourneyResultCard } from './JourneyResultCard';
import type { Journey } from '../types';

interface JourneyResultsListProps {
  journeys: Journey[];
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  selectedIndex: number | null;
  canSave: boolean;
  onSaveJourney?: (journey: Journey) => Promise<void>;
  onStartNavigation: (journey: Journey) => void;
}

function ResultSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-5 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 flex gap-1.5">
        <div className="h-6 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-6 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

export function JourneyResultsList({
  journeys,
  loading,
  error,
  hasSearched,
  selectedIndex,
  canSave,
  onSaveJourney,
  onStartNavigation,
}: JourneyResultsListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Recherche d'itinéraires en cours">
        <ResultSkeleton />
        <ResultSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (hasSearched && journeys.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Aucun itinéraire trouvé pour ce trajet.
      </p>
    );
  }

  if (!hasSearched) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Renseignez un départ et une arrivée pour voir les itinéraires disponibles.
      </p>
    );
  }

  // Only the ModePicker-selected candidate renders — the picker already
  // narrows "which Journey" to one, so stacking every other candidate below
  // it would just repeat the same choice in list form.
  const journey = selectedIndex !== null ? journeys[selectedIndex] : undefined;
  if (!journey) return null;

  return (
    <div className="flex flex-col gap-3">
      <JourneyResultCard
        journey={journey}
        canSave={canSave}
        onSave={onSaveJourney ? () => onSaveJourney(journey) : undefined}
        onStartNavigation={() => onStartNavigation(journey)}
      />
    </div>
  );
}
