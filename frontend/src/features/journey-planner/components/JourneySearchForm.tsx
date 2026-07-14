'use client';

import { useState } from 'react';
import { ArrowsDownUp, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { AddressInput } from './AddressInput';
import type { JourneyPoint, JourneySortCriterion } from '../types';

interface JourneySearchFormProps {
  sort: JourneySortCriterion;
  onSortChange: (sort: JourneySortCriterion) => void;
  loading: boolean;
  onSearch: (origin: JourneyPoint, destination: JourneyPoint) => void;
}

export function JourneySearchForm({ sort, onSortChange, loading, onSearch }: JourneySearchFormProps) {
  const [origin, setOrigin] = useState<JourneyPoint | null>(null);
  const [destination, setDestination] = useState<JourneyPoint | null>(null);

  const canSearch = origin !== null && destination !== null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!origin || !destination) return;
    onSearch(origin, destination);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <AddressInput label="Départ" value={origin} onChange={setOrigin} allowGeolocation />
      <AddressInput label="Arrivée" value={destination} onChange={setDestination} />

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
