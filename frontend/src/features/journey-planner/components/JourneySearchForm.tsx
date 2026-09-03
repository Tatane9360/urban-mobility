'use client';

import { useId, useState } from 'react';
import { ArrowsDownUp, ArrowUp, ArrowDown, Clock, MagnifyingGlass, MapPin } from '@phosphor-icons/react/dist/ssr';
import { AddressInput } from './AddressInput';
import { geocode } from '../api/geocode';
import type { JourneyPoint, JourneySortCriterion, MapPickTarget } from '../types';
import type { FavoriteAddress } from '../../profile/types';

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
  // Swaps the two points and their map-pick labels, which the screen owns.
  onSwap: () => void;
  // The signed-in user's saved addresses, offered as quick picks in both
  // fields. Absent (or empty) for a guest — AddressInput defaults it to [].
  favoriteAddresses?: FavoriteAddress[];
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
  onSwap,
  favoriteAddresses,
}: JourneySearchFormProps) {
  const departureId = useId();
  // Empty means "maintenant": the request omits departureTime and the backend
  // defaults to now, so there is no clock state to keep in sync.
  const [departureTime, setDepartureTime] = useState('');
  // Text typed into each field but not resolved to a point by clicking a
  // suggestion. Submitting geocodes it rather than refusing silently.
  const [queries, setQueries] = useState({ origin: '', destination: '' });
  const [fieldErrors, setFieldErrors] = useState<{ origin: string | null; destination: string | null }>({
    origin: null,
    destination: null,
  });
  const [resolving, setResolving] = useState(false);
  // Bumped on every swap to remount both AddressInputs, since each owns the
  // text it displays and cannot be rewritten from here.
  const [swapCount, setSwapCount] = useState(0);

  // The return trip is the commonest second search there is, and it used to
  // mean retyping both addresses.
  function handleSwap() {
    onSwap();
    setQueries(({ origin, destination }) => ({ origin: destination, destination: origin }));
    setFieldErrors({ origin: null, destination: null });
    setSwapCount((n) => n + 1);
  }

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
      <div className="relative flex items-stretch gap-3">
        {/* Route rail: origin dot, a dotted thread down to the destination
            pin — the same visual grammar as a stop list, so the two fields
            read as one trip rather than two unrelated inputs. */}
        <div className="flex w-4 shrink-0 flex-col items-center pt-[1.375rem] pb-[1.375rem]" aria-hidden="true">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-zinc-400 dark:border-zinc-500" />
          <span className="my-1 w-px flex-1 border-l-2 border-dotted border-zinc-300 dark:border-zinc-700" />
          <MapPin size={16} weight="fill" className="shrink-0 text-accent" />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <AddressInput
            key={`origin-${swapCount}`}
            label="Départ"
            value={origin}
            onChange={onOriginChange}
            allowGeolocation
            picking={pickTarget === 'origin'}
            onTogglePick={() => onPickTargetChange(pickTarget === 'origin' ? null : 'origin')}
            pickedLabel={pickedLabels.origin}
            favorites={favoriteAddresses}
            initialQuery={queries.origin}
            onQueryChange={(q) => {
              setQueries((s) => ({ ...s, origin: q }));
              setFieldErrors((e) => (e.origin ? { ...e, origin: null } : e));
            }}
            error={fieldErrors.origin}
          />
          <AddressInput
            key={`destination-${swapCount}`}
            label="Arrivée"
            value={destination}
            onChange={onDestinationChange}
            picking={pickTarget === 'destination'}
            onTogglePick={() => onPickTargetChange(pickTarget === 'destination' ? null : 'destination')}
            pickedLabel={pickedLabels.destination}
            favorites={favoriteAddresses}
            initialQuery={queries.destination}
            onQueryChange={(q) => {
              setQueries((s) => ({ ...s, destination: q }));
              setFieldErrors((e) => (e.destination ? { ...e, destination: null } : e));
            }}
            error={fieldErrors.destination}
          />
        </div>

        {/* Off to the side rather than on the divider, so it never sits over
            either field's own trailing buttons. */}
        <button
          type="button"
          onClick={handleSwap}
          aria-label="Inverser le départ et l'arrivée"
          className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-colors hover:border-accent hover:text-accent dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
        >
          <span className="relative block h-4 w-4 overflow-hidden">
            <ArrowUp
              size={16}
              weight="bold"
              className={`absolute inset-0 transition-all duration-200 ${swapCount % 2 === 0 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            />
            <ArrowDown
              size={16}
              weight="bold"
              className={`absolute inset-0 transition-all duration-200 ${swapCount % 2 === 0 ? '-translate-y-4 opacity-0' : 'translate-y-0 opacity-100'}`}
            />
          </span>
        </button>
      </div>

      <div>
        <label
          htmlFor={departureId}
          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Heure de départ
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 transition-colors focus-within:border-accent dark:border-zinc-800 dark:bg-zinc-900">
          <Clock className="shrink-0 text-zinc-400" size={18} />
          <input
            id={departureId}
            type="datetime-local"
            value={departureTime}
            aria-describedby={`${departureId}-hint`}
            onChange={(e) => setDepartureTime(e.target.value)}
            // The calendar/time popup is browser-rendered, not ours to
            // restyle — color-scheme is the one lever that keeps it legible,
            // so the dark picker doesn't render dark text on a dark sheet.
            className="h-11 w-full bg-transparent text-sm text-zinc-900 outline-none [color-scheme:light] dark:text-zinc-50 dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:rounded [&::-webkit-calendar-picker-indicator]:p-1 [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:transition-opacity hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
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
