import { useState } from 'react';
import { BookmarkSimple, Check, NavigationArrow, WarningCircle } from '@phosphor-icons/react/dist/ssr';
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

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onSave || saveState !== 'idle') return;
    setSaveState('saving');
    try {
      await onSave();
      setSaveState('saved');
    } catch {
      setSaveState('idle');
    }
  }

  return (
    <div className="w-full rounded-lg border border-[#1E3A5F] bg-[#1E3A5F]/5 p-4 text-left dark:border-[#3B6EA5] dark:bg-[#3B6EA5]/10">
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
              className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-[#1E3A5F] disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:hover:text-[#3B6EA5]"
            >
              {saveState === 'saved' ? (
                <Check size={16} weight="bold" className="text-[#1E3A5F] dark:text-[#3B6EA5]" />
              ) : (
                <BookmarkSimple size={16} weight={saveState === 'saving' ? 'fill' : 'regular'} />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {journey.segments.map((segment, index) => (
          <SegmentBadge key={`${segment.mode}-${index}`} segment={segment} />
        ))}
      </div>

      <button
        type="button"
        onClick={onStartNavigation}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#16293F] dark:bg-[#3B6EA5] dark:hover:bg-[#4E82BA]"
      >
        <NavigationArrow size={16} weight="bold" />
        Démarrer l&apos;itinéraire
      </button>

      {journey.degraded && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          <WarningCircle size={14} />
          <span>Horaires théoriques (temps réel indisponible)</span>
        </div>
      )}
    </div>
  );
}
