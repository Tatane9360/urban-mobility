'use client';

import { useId, useState } from 'react';
import { ArrowsDownUp, Clock, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { AddressInput } from './AddressInput';
import { geocode } from '../api/geocode';
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
  // Text typed into each field but not resolved to a point by clicking a
  // suggestion. Submitting geocodes it rather than refusing silently.
  const [queries, setQueries] = useState({ origin: '', destination: '' });
  const [fieldErrors, setFieldErrors] = useState<{ origin: string | null; destination: string | null }>({
    origin: null,
    destination: null,
  });
  const [resolving, setResolving] = useState(false);

  // Resolve a field the user typed but never picked from the list. Returns
  // null when there is nothing usable, and records why.
  async function resolvePoint(
    field: 'origin' | 'destination',
    point: JourneyPoint | null,
  ): Promise<JourneyPoint | null> {
    if (point) return point;
    const query = queries[field].trim();
    if (!query) {
      setFieldErrors((e) => ({ ...e, [field]: 'Renseignez une adresse.' }));
      return null;
    }
    try {
      const [best] = await geocode(query);
      if (!best) {
        setFieldErrors((e) => ({ ...e, [field]: 'Adresse introuvable. Précisez-la ou choisissez une suggestion.' }));
        return null;
      }
      return { coordinates: { lat: best.lat, lon: best.lon } };
    } catch {
      setFieldErrors((e) => ({ ...e, [field]: "Impossible de vérifier cette adresse pour le moment." }));
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (resolving) return;
    setFieldErrors({ origin: null, destination: null });
    setResolving(true);
    try {
      const [from, to] = await Promise.all([
        resolvePoint('origin', origin),
        resolvePoint('destination', destination),
      ]);
      if (!from || !to) return;
      // Keep the resolved points so a retry does not geocode twice.
      if (!origin) onOriginChange(from);
      if (!destination) onDestinationChange(to);
      // datetime-local has no offset, so read it against the browser's clock and
      // send an absolute instant the backend can't misread.
      onSearch(from, to, departureTime ? new Date(departureTime).toISOString() : undefined);
    } finally {
      setResolving(false);
    }
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
        onQueryChange={(q) => {
          setQueries((s) => ({ ...s, origin: q }));
          setFieldErrors((e) => (e.origin ? { ...e, origin: null } : e));
        }}
        error={fieldErrors.origin}
      />
      <AddressInput
        label="Arrivée"
        value={destination}
        onChange={onDestinationChange}
        picking={pickTarget === 'destination'}
        onTogglePick={() => onPickTargetChange(pickTarget === 'destination' ? null : 'destination')}
        pickedLabel={pickedLabels.destination}
        onQueryChange={(q) => {
          setQueries((s) => ({ ...s, destination: q }));
          setFieldErrors((e) => (e.destination ? { ...e, destination: null } : e));
        }}
        error={fieldErrors.destination}
      />

      <div>
        <label
          htmlFor={departureId}
          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Heure de départ
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 focus-within:border-accent dark:border-zinc-800 dark:bg-zinc-900">
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
            className="rounded-md border border-zinc-200 bg-transparent py-1 pl-2 pr-6 text-sm text-zinc-700 outline-none focus:border-accent dark:border-zinc-800 dark:text-zinc-300"
          >
            <option value="duration">Plus rapide</option>
            <option value="carbon">Plus écologique</option>
          </select>
        </div>

        {/* Never disabled on missing points: submitting resolves what was
            typed, and says which field is at fault when it cannot. */}
        <button
          type="submit"
          disabled={loading || resolving}
          className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MagnifyingGlass size={16} weight="bold" />
          {loading || resolving ? 'Recherche…' : 'Rechercher'}
        </button>
      </div>
    </form>
  );
}
