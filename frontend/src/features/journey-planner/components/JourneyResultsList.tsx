import { JourneyResultCard } from './JourneyResultCard';
import { TransportMode, type Journey } from '../types';

interface JourneyResultsListProps {
  journeys: Journey[];
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
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
  onSelect,
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

  const journey = selectedIndex !== null ? journeys[selectedIndex] : undefined;
  if (!journey) return null;

  // The ModePicker only exposes the fastest candidate per mode, so without
  // this the other departures the planner returned would never be reachable.
  // Same core mode as the selected one: a Tram alternative next to a Tram
  // result is a real choice (another boarding stop, another departure), while
  // listing the walk-only candidate here would duplicate the picker.
  const alternatives = journeys
    .map((candidate, index) => ({ candidate, index }))
    .filter(
      ({ candidate, index }) =>
        index !== selectedIndex && coreMode(candidate) === coreMode(journey),
    );

  return (
    <div className="flex flex-col gap-3">
      <JourneyResultCard
        journey={journey}
        canSave={canSave}
        onSave={onSaveJourney ? () => onSaveJourney(journey) : undefined}
        onStartNavigation={() => onStartNavigation(journey)}
      />

      {alternatives.length > 0 && (
        <section aria-label="Autres itinéraires" className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Autres options
          </h3>
          {alternatives.map(({ candidate, index }) => (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(index)}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm transition-colors hover:border-[#1E3A5F] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[#3B6EA5]"
            >
              <span className="text-zinc-900 dark:text-zinc-50">
                {formatDuration(candidate.durationSeconds)}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {boardingLabel(candidate)}
              </span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

// The mode that defines the Journey: bridging Marche segments wrap every
// transit and Vélo candidate, so the first non-Marche segment is what the
// rider would call this trip. Walk-only stays Marche.
function coreMode(journey: Journey): TransportMode {
  return (
    journey.segments.find((s) => s.mode !== TransportMode.Marche)?.mode ??
    TransportMode.Marche
  );
}

// What actually separates two alternatives on the same line: where you board
// and when it leaves.
function boardingLabel(journey: Journey): string {
  const leg = journey.segments.find((s) => s.mode !== TransportMode.Marche);
  if (!leg) return 'À pied';
  const time = new Date(leg.startTime).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${leg.from.name} · ${time}`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}
