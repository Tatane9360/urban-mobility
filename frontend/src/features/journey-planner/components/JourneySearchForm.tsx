'use client';

import { useId, useState } from 'react';
import { ArrowsDownUp, Clock, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { AddressInput } from './AddressInput';
import type { JourneyPoint, JourneySortCriterion, MapPickTarget } from '../types';

interface JourneySearchFormProps {
  sort: JourneySortCriterion;
  onSortChange: (sort: JourneySortCriterion) => void;
  loading: boolean;
  onSearch: (origin: JourneyPoint, destination: JourneyPoint, departureTime?: string) => void;
  // "Pick on the map" mode lives in the screen, since the map is a sibling of
  // this form — the form only says which field is waiting for a click.
  pickTarget: MapPickTarget;
  onPickTargetChange: (target: MapPickTarget) => void;
  origin: JourneyPoint | null;
  onOriginChange: (point: JourneyPoint | null) => void;
  destination: JourneyPoint | null;
  onDestinationChange: (point: JourneyPoint | null) => void;
  pickedLabels: { origin: string | null; destination: string | null };
}

export function JourneySearchForm({
  sort,
  onSortChange,
  loading,
  onSearch,
  pickTarget,
  onPickTargetChange,
  origin,
  onOriginChange,
  destination,
  onDestinationChange,
  pickedLabels,
}: JourneySearchFormProps) {
  const departureId = useId();
  // ponytail: empty means "maintenant" — no clock state to keep in sync, and
  // the request simply omits departureTime so the backend defaults to now.
  const [departureTime, setDepartureTime] = useState('');

  const canSearch = origin !== null && destination !== null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!origin || !destination) return;
    // datetime-local has no offset, so read it against the browser's clock and
    // send an absolute instant the backend can't misread.
    onSearch(origin, destination, departureTime ? new Date(departureTime).toISOString() : undefined);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <AddressInput
        label="Départ"
        value={origin}
        onChange={onOriginChange}
        allowGeolocation
        picking={pickTarget === 'origin'}
        onTogglePick={() => onPickTargetChange(pickTarget === 'origin' ? null : 'origin')}
        pickedLabel={pickedLabels.origin}
      />
      <AddressInput
        label="Arrivée"
        value={destination}
        onChange={onDestinationChange}
        picking={pickTarget === 'destination'}
        onTogglePick={() => onPickTargetChange(pickTarget === 'destination' ? null : 'destination')}
        pickedLabel={pickedLabels.destination}
      />

      <div>
        <label
          htmlFor={departureId}
          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Heure de départ
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 focus-within:border-[#1E3A5F] dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-[#3B6EA5]">
          <Clock className="shrink-0 text-zinc-400" size={18} />
          <input
            id={departureId}
            type="datetime-local"
            value={departureTime}
            aria-describedby={`${departureId}-hint`}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="h-11 w-full bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-50"
          />
        </div>
        <p id={`${departureId}-hint`} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Laissez vide pour partir maintenant.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <ArrowsDownUp size={16} />
          <label htmlFor="sort-criterion" className="sr-only">
            Trier les itinéraires par
          </label>
          <select
            id="sort-criterion"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as JourneySortCriterion)}
            className="rounded-md border border-zinc-200 bg-transparent py-1 pl-2 pr-6 text-sm text-zinc-700 outline-none focus:border-[#1E3A5F] dark:border-zinc-800 dark:text-zinc-300 dark:focus:border-[#3B6EA5]"
          >
            <option value="duration">Plus rapide</option>
            <option value="carbon">Plus écologique</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={!canSearch || loading}
          className="flex h-10 items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#16293F] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#3B6EA5] dark:hover:bg-[#4E82BA]"
        >
          <MagnifyingGlass size={16} weight="bold" />
          {loading ? 'Recherche…' : 'Rechercher'}
        </button>
      </div>
    </form>
  );
}
