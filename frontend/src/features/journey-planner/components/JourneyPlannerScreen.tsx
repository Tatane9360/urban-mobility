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
import { formatCoordinates } from '../format-coordinates';
import type { Coordinates, Journey, JourneyPoint, MapPickTarget } from '../types';

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
  // Origin/destination live here rather than in the form: the map is a
  // sibling, and a map click has to reach whichever field is armed.
  const [origin, setOrigin] = useState<JourneyPoint | null>(null);
  const [destination, setDestination] = useState<JourneyPoint | null>(null);
  const [pickTarget, setPickTarget] = useState<MapPickTarget>(null);
  const [pickedLabels, setPickedLabels] = useState<{ origin: string | null; destination: string | null }>({
    origin: null,
    destination: null,
  });

  // Typing (or geocoding) over a picked point drops its label, handing the
  // text box back to what the user is typing.
  function setPointFor(target: 'origin' | 'destination', point: JourneyPoint | null) {
    (target === 'origin' ? setOrigin : setDestination)(point);
    setPickedLabels((labels) => ({ ...labels, [target]: null }));
  }

  function handleMapPick(point: Coordinates) {
    if (!pickTarget) return;
    const setPoint = pickTarget === 'origin' ? setOrigin : setDestination;
    setPoint({ coordinates: point });
    setPickedLabels((labels) => ({ ...labels, [pickTarget]: formatCoordinates(point) }));
    setPickTarget(null);
  }

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
          onPick={pickTarget ? handleMapPick : undefined}
        />
        {pickTarget && (
          <div
            role="status"
            className="absolute left-1/2 top-3 z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-full border border-zinc-200 bg-white/95 py-1.5 pl-4 pr-1.5 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-300"
          >
            Cliquez pour choisir {pickTarget === 'origin' ? 'le départ' : "l'arrivée"}
            <button
              type="button"
              onClick={() => setPickTarget(null)}
              className="rounded-full px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Annuler
            </button>
          </div>
        )}
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
        <JourneySearchForm
          sort={sort}
          onSortChange={setSort}
          loading={loading}
          onSearch={handleSearch}
          pickTarget={pickTarget}
          onPickTargetChange={setPickTarget}
          origin={origin}
          onOriginChange={(point) => setPointFor('origin', point)}
          destination={destination}
          onDestinationChange={(point) => setPointFor('destination', point)}
          pickedLabels={pickedLabels}
        />
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
