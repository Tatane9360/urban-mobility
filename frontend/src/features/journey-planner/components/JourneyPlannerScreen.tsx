'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ArrowsOutSimple, ArrowsInSimple, Crosshair, Bicycle } from '@phosphor-icons/react/dist/ssr';
import { AlertsBanner } from './AlertsBanner';
import { JourneySearchForm } from './JourneySearchForm';
import { JourneyResultsList } from './JourneyResultsList';
import { ModePicker } from './ModePicker';
import { NavigationOverlay } from './NavigationOverlay';
import { NearbyStationsList } from './NearbyStationsList';
import { useJourneyPlanner } from '../hooks/useJourneyPlanner';
import { useAuth } from '../../auth/hooks/useAuth';
import { useProfile } from '../../profile/hooks/useProfile';
import { saveJourney } from '../api/save-journey';
import { buildNavigationSteps } from '../navigation-steps';
import { formatCoordinates } from '../format-coordinates';
import type { BikeStation, Coordinates, Journey, JourneyPoint, MapPickTarget } from '../types';

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
  const router = useRouter();
  const { token } = useAuth();
  const { profile } = useProfile();
  const { journeys, loading, error, sort, setSort, search, retry } = useJourneyPlanner();
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
  // Simulated "my position" for "stations near me" — no real GPS in this demo,
  // so the user clicks a point on the map instead (see JourneyMap.nearbyOrigin).
  const [nearbyOrigin, setNearbyOrigin] = useState<Coordinates | null>(null);
  const [nearbyStations, setNearbyStations] = useState<(BikeStation & { distanceMeters: number })[]>([]);
  const [bikeStationsFetchedAt, setBikeStationsFetchedAt] = useState<string | null>(null);
  // Off by default — station markers are noise until the user asks for them.
  const [showBikeStations, setShowBikeStations] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  // Typing (or geocoding) over a picked point drops its label, handing the
  // text box back to what the user is typing.
  function setPointFor(target: 'origin' | 'destination', point: JourneyPoint | null) {
    (target === 'origin' ? setOrigin : setDestination)(point);
    setPickedLabels((labels) => ({ ...labels, [target]: null }));
  }

  // Origin and destination trade places, labels included. The form flips the
  // text the user typed; only what lives here can be swapped from here.
  function swapEndpoints() {
    setOrigin(destination);
    setDestination(origin);
    setPickedLabels((labels) => ({ origin: labels.destination, destination: labels.origin }));
    setPickTarget(null);
  }

  function handleMapPick(point: Coordinates) {
    if (!pickTarget) return;
    if (pickTarget === 'nearby-stations') {
      setNearbyOrigin(point);
      setPickTarget(null);
      return;
    }
    const setPoint = pickTarget === 'origin' ? setOrigin : setDestination;
    setPoint({ coordinates: point });
    setPickedLabels((labels) => ({ ...labels, [pickTarget]: formatCoordinates(point) }));
    setPickTarget(null);
  }

  function toggleNearbyStations() {
    if (pickTarget === 'nearby-stations') {
      setPickTarget(null);
    } else {
      setNearbyOrigin(null);
      setPickTarget('nearby-stations');
    }
  }

  function handleSearch(...args: Parameters<typeof search>) {
    setHasSearched(true);
    setSelectedIndex(null);
    setNavigatingJourney(null);
    void search(...args).then((results) => setSelectedIndex(results.length > 0 ? 0 : null));
  }

  function handleStartNavigation(journey: Journey) {
    setNavigatingJourney(journey);
    setNavStepIndex(0);
    setMapExpanded(true);
    setFinishError(null);
  }

  function handleExitNavigation() {
    setNavigatingJourney(null);
    setMapExpanded(false);
  }

  // A trip only enters the user's history once they've actually completed
  // it — not just searched for it (see NavigationOverlay.onFinish). A failed
  // save keeps the walkthrough open with an inline error instead of
  // redirecting anyway, so a finished trip is never silently lost.
  async function handleFinishNavigation() {
    if (!token || !navigatingJourney) return;
    try {
      await saveJourney(token, navigatingJourney);
      handleExitNavigation();
      // setTimeout, not a direct call: handleExitNavigation's setNavigatingJourney(null)
      // still has to flow through a React re-render (JourneyMap loses its
      // currentPosition/journey props and repositions its Leaflet markers).
      // Navigating away in the same tick can unmount the map mid-update, and
      // Leaflet then reaches into a DOM node React already detached — a
      // "Cannot read properties of undefined (reading '_leaflet_pos')" crash.
      setTimeout(() => router.push('/history'), 0);
    } catch {
      setFinishError("Impossible d'enregistrer ce trajet. Réessayez.");
    }
  }

  const selectedJourney = selectedIndex !== null ? (journeys[selectedIndex] ?? null) : null;
  const navSteps = navigatingJourney ? buildNavigationSteps(navigatingJourney.segments) : [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 lg:flex-row-reverse lg:gap-6 lg:p-6">
      <div
        className={`relative w-full shrink-0 lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)] lg:flex-1 ${
          // -6rem clears MobileTabBar (4rem) plus the container's own 2rem
          // vertical padding — the bar sits fixed below this element, and
          // without the extra room the expanded map renders half under it.
          mapExpanded ? 'h-[calc(100dvh-6rem)]' : 'h-[38vh] min-h-[220px]'
        }`}
      >
        <JourneyMap
          journey={navigatingJourney ?? selectedJourney}
          focusBounds={navigatingJourney ? navSteps[navStepIndex]?.bounds : undefined}
          currentPosition={navigatingJourney ? navSteps[navStepIndex]?.currentPosition : undefined}
          onPick={pickTarget ? handleMapPick : undefined}
          nearbyOrigin={nearbyOrigin}
          onNearbyStationsChange={setNearbyStations}
          onBikeStationsFetchedAtChange={setBikeStationsFetchedAt}
          showBikeStations={showBikeStations}
        />
        {pickTarget && (
          <div
            role="status"
            // top-14 clears the right-3 top-3 button row (h-9 ≈ 2.25rem) this
            // pill would otherwise sit under on narrow screens, since both are
            // absolutely positioned and don't share layout flow.
            className="absolute left-1/2 top-14 z-[1000] flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 py-1.5 pl-4 pr-1.5 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-300"
          >
            {pickTarget === 'nearby-stations'
              ? 'Cliquez sur la carte pour simuler votre position'
              : `Cliquez pour choisir ${pickTarget === 'origin' ? 'le départ' : "l'arrivée"}`}
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
            onFinish={token ? handleFinishNavigation : undefined}
            finishError={finishError}
          />
        ) : (
          <div className="absolute right-3 top-3 z-[1000] flex gap-2">
            <button
              type="button"
              onClick={() => setShowBikeStations((v) => !v)}
              aria-pressed={showBikeStations}
              aria-label={showBikeStations ? 'Masquer les stations de vélo' : 'Afficher les stations de vélo'}
              className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors ${
                showBikeStations
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              <Bicycle size={16} />
            </button>
            <button
              type="button"
              onClick={toggleNearbyStations}
              aria-pressed={pickTarget === 'nearby-stations'}
              aria-label="Chercher des stations de vélo proches"
              className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors ${
                pickTarget === 'nearby-stations'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              <Crosshair size={16} />
            </button>
            <button
              type="button"
              onClick={() => setMapExpanded((v) => !v)}
              aria-label={mapExpanded ? 'Réduire la carte' : 'Agrandir la carte'}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 lg:hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {mapExpanded ? <ArrowsInSimple size={16} /> : <ArrowsOutSimple size={16} />}
            </button>
          </div>
        )}
      </div>

      <div
        className={`flex w-full flex-col gap-4 lg:w-[420px] lg:shrink-0 ${mapExpanded || navigatingJourney ? 'hidden lg:flex' : ''}`}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl dark:text-zinc-50">
          Planifier un trajet
        </h1>
        {nearbyOrigin && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Stations proches</h2>
              <button
                type="button"
                onClick={() => setNearbyOrigin(null)}
                className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Fermer
              </button>
            </div>
            <NearbyStationsList stations={nearbyStations} fetchedAt={bikeStationsFetchedAt} />
          </div>
        )}
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
          onSwap={swapEndpoints}
          favoriteAddresses={profile?.favoriteAddresses}
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
          onSelect={setSelectedIndex}
          isLoggedIn={token !== null}
          onStartNavigation={handleStartNavigation}
          onRetry={retry}
        />
      </div>
    </div>
  );
}
