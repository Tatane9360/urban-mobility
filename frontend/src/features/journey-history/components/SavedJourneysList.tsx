import { SavedJourneyCard } from './SavedJourneyCard';
import type { SavedJourney } from '../types';

function CardSkeleton() {
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

interface SavedJourneysListProps {
  journeys: SavedJourney[];
  loading: boolean;
  onDelete: (id: string) => Promise<void>;
}

export function SavedJourneysList({ journeys, loading, onDelete }: SavedJourneysListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Chargement de l'historique">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (journeys.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Aucun itinéraire sauvegardé pour le moment. Terminez un trajet depuis le planificateur pour le
        retrouver ici.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {journeys.map((journey) => (
        <SavedJourneyCard key={journey.id} journey={journey} onDelete={onDelete} />
      ))}
    </div>
  );
}
