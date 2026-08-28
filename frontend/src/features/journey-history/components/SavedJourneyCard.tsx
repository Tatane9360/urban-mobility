'use client';

import { useState } from 'react';
import { Leaf, Trash, WarningCircle } from '@phosphor-icons/react/dist/ssr';
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

interface SavedJourneyCardProps {
  journey: SavedJourney;
  onDelete: (id: string) => Promise<void>;
}

export function SavedJourneyCard({ journey, onDelete }: SavedJourneyCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const label = `${formatDuration(journey.durationSeconds)} du ${formatDate(journey.savedAt)}`;

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(journey.id);
    } finally {
      setDeleting(false);
    }
  }

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
        <div className="flex shrink-0 items-start gap-2">
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatDate(journey.savedAt)}</span>
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <Leaf size={14} />
              <span>{formatGrams(journey.carbonGrams)} CO₂e</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Supprimer l'itinéraire ${label}`}
            className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
          >
            <Trash size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {journey.segments.map((segment, index) => (
          <SegmentBadge key={`${segment.mode}-${index}`} segment={segment} />
        ))}
      </div>

      {confirming && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
          <span className="flex-1">Supprimer définitivement cet itinéraire&nbsp;?</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label={`Confirmer la suppression de l'itinéraire ${label}`}
            className="rounded-md bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded-md px-2.5 py-1 font-medium hover:bg-red-100 disabled:opacity-40 dark:hover:bg-red-900/40"
          >
            Annuler
          </button>
        </div>
      )}

      {journey.degraded && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          <WarningCircle size={14} />
          <span>Horaires théoriques (temps réel indisponible)</span>
        </div>
      )}
    </div>
  );
}
