import { useState } from 'react';
import { BookmarkSimple, Check, NavigationArrow } from '@phosphor-icons/react/dist/ssr';
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
  canSave: boolean;
  onSave?: () => Promise<void>;
  onStartNavigation: () => void;
}

export function JourneyResultCard({ journey, canSave, onSave, onStartNavigation }: JourneyResultCardProps) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  // A failed save used to drop straight back to idle with no message: on
  // flaky mobile data the bookmark simply never stuck, silently.
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onSave || saveState !== 'idle') return;
    setSaveState('saving');
    setSaveError(null);
    try {
      await onSave();
      setSaveState('saved');
    } catch {
      setSaveState('idle');
      setSaveError("Impossible d'enregistrer cet itinéraire. Réessayez.");
    }
  }

  return (
    <div className="w-full rounded-lg border border-accent bg-accent/5 p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {formatDuration(journey.durationSeconds)}
        </span>
        <div className="flex items-center gap-3">
          <CarbonBadge carbonGrams={journey.carbonGrams} carComparison={journey.carComparison} />
          {canSave && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState !== 'idle'}
              aria-label={saveState === 'saved' ? 'Itinéraire sauvegardé' : 'Sauvegarder cet itinéraire'}
              className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-accent disabled:hover:bg-transparent dark:hover:bg-zinc-800"
            >
              {saveState === 'saved' ? (
                <Check size={16} weight="bold" className="text-accent" />
              ) : (
                <BookmarkSimple size={16} weight={saveState === 'saving' ? 'fill' : 'regular'} />
              )}
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">
          {saveError}
        </p>
      )}
      {/* The check icon is the only success signal otherwise, which a screen
          reader never sees. */}
      <p role="status" aria-live="polite" className="sr-only">
        {saveState === 'saved' ? 'Itinéraire enregistré.' : ''}
      </p>

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
