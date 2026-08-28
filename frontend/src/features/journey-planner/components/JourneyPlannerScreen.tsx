'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowsOutSimple, ArrowsInSimple } from '@phosphor-icons/react/dist/ssr';
import { AlertsBanner } from './AlertsBanner';
import { JourneySearchForm } from './JourneySearchForm';
import { JourneyResultsList } from './JourneyResultsList';
import { ModePicker } from './ModePicker';
import { NavigationOverlay } from './NavigationOverlay';
import { useJourneyPlanner } from '../hooks/useJourneyPlanner';
import { useAuth } from '../../auth/hooks/useAuth';
import { saveJourney } from '../api/save-journey';
import { buildNavigationSteps } from '../navigation-steps';
import type { Journey } from '../types';

// Leaflet touches `window` at import time — must stay out of the server bundle.
// The loading placeholder matters beyond UX: without it, Lighthouse picks the
// first OSM tile <img> (an external, uncontrolled network resource) as the
// LCP element, which tanked the mobile Performance score below the PRD's
// KPI. This div becomes the LCP element instead — paints instantly from CSS.
const JourneyMap = dynamic(() => import('./JourneyMap').then((m) => m.JourneyMap), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[320px] w-full animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
  ),
});

export function JourneyPlannerScreen() {
  const { token } = useAuth();
  const { journeys, loading, error, sort, setSort, search } = useJourneyPlanner();
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [navigatingJourney, setNavigatingJourney] = useState<Journey | null>(null);
  const [navStepIndex, setNavStepIndex] = useState(0);

  function handleSearch(...args: Parameters<typeof search>) {
    setHasSearched(true);
    setSelectedIndex(null);
    setNavigatingJourney(null);
    void search(...args).then((results) => setSelectedIndex(results.length > 0 ? 0 : null));
  }

  async function handleSaveJourney(journey: Journey) {
    if (!token) return;
    await saveJourney(token, journey);
  }

  function handleStartNavigation(journey: Journey) {
    setNavigatingJourney(journey);
    setNavStepIndex(0);
    setMapExpanded(true);
  }

  function handleExitNavigation() {
    setNavigatingJourney(null);
    setMapExpanded(false);
  }

  const selectedJourney = selectedIndex !== null ? (journeys[selectedIndex] ?? null) : null;
  const navSteps = navigatingJourney ? buildNavigationSteps(navigatingJourney.segments) : [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 lg:flex-row-reverse lg:gap-6 lg:p-6">
      <div
        className={`relative w-full shrink-0 lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)] lg:flex-1 ${
          mapExpanded ? 'h-[calc(100dvh-2rem)]' : 'h-[38vh] min-h-[220px]'
        }`}
      >
        <JourneyMap
          journey={navigatingJourney ?? selectedJourney}
          focusBounds={navigatingJourney ? navSteps[navStepIndex]?.bounds : undefined}
          currentPosition={navigatingJourney ? navSteps[navStepIndex]?.currentPosition : undefined}
        />
        {navigatingJourney ? (
          <NavigationOverlay
            steps={navSteps}
            currentIndex={navStepIndex}
            onPrevious={() => setNavStepIndex((i) => Math.max(0, i - 1))}
            onNext={() => setNavStepIndex((i) => Math.min(navSteps.length - 1, i + 1))}
            onExit={handleExitNavigation}
          />
        ) : (
          <button
            type="button"
            onClick={() => setMapExpanded((v) => !v)}
            aria-label={mapExpanded ? 'Réduire la carte' : 'Agrandir la carte'}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 lg:hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {mapExpanded ? <ArrowsInSimple size={16} /> : <ArrowsOutSimple size={16} />}
          </button>
        )}
      </div>

      <div
        className={`flex w-full flex-col gap-4 lg:w-[420px] lg:shrink-0 ${mapExpanded || navigatingJourney ? 'hidden lg:flex' : ''}`}
      >
        <AlertsBanner />
        <JourneySearchForm sort={sort} onSortChange={setSort} loading={loading} onSearch={handleSearch} />
        {hasSearched && !loading && (
          <ModePicker journeys={journeys} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
        )}
        <JourneyResultsList
          journeys={journeys}
          loading={loading}
          error={error}
          hasSearched={hasSearched}
          selectedIndex={selectedIndex}
          canSave={token !== null}
          onSaveJourney={token ? handleSaveJourney : undefined}
          onStartNavigation={handleStartNavigation}
        />
      </div>
    </div>
  );
}
