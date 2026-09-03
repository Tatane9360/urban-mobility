'use client';

import { useEffect, useRef } from 'react';
import { CaretLeft, CaretRight, Check, X } from '@phosphor-icons/react/dist/ssr';
import type { NavStep } from '../navigation-steps';

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

interface NavigationOverlayProps {
  steps: NavStep[];
  currentIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
  // Present only for a logged-in user (see JourneyPlannerScreen) — a guest
  // has no history to save the trip into, so the last step just stays a
  // disabled "Suivant" for them, same as today.
  onFinish?: () => void;
  // Set when the last save attempt (onFinish) failed — keeps the walkthrough
  // open with the reason instead of losing a finished trip silently.
  finishError?: string | null;
}

export function NavigationOverlay({
  steps,
  currentIndex,
  onPrevious,
  onNext,
  onExit,
  onFinish,
  finishError,
}: NavigationOverlayProps) {
  const headingRef = useRef<HTMLSpanElement>(null);
  const step = steps[currentIndex];

  // Starting navigation hides the results panel (`hidden lg:flex`), so the
  // button that was focused disappears under the user. Pull focus into the
  // overlay instead of leaving it on an element that is no longer rendered.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Escape is the expected way out of a dialog, and on mobile the overlay
  // covers the whole map.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onExit();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  if (!step) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation pas à pas"
      className="absolute inset-x-3 top-3 z-[1000] flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Étape {currentIndex + 1} / {steps.length}
          </span>
          <span
            ref={headingRef}
            tabIndex={-1}
            aria-live="assertive"
            className="text-sm font-semibold text-zinc-900 outline-none dark:text-zinc-50"
          >
            {step.instruction}
          </span>
          {step.distanceMeters > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatDistance(step.distanceMeters)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onExit}
          aria-label="Quitter la navigation"
          className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <CaretLeft size={14} weight="bold" />
          Précédent
        </button>
        {currentIndex === steps.length - 1 && onFinish ? (
          <button
            type="button"
            onClick={onFinish}
            className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Trajet terminé
            <Check size={14} weight="bold" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={currentIndex === steps.length - 1}
            className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Suivant
            <CaretRight size={14} weight="bold" />
          </button>
        )}
      </div>

      {finishError && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {finishError}
        </p>
      )}
    </div>
  );
}
