'use client';

import { useId, useState } from 'react';
import { MapPin, NavigationArrow } from '@phosphor-icons/react/dist/ssr';
import { useGeocodeSuggestions } from '../hooks/useGeocodeSuggestions';
import type { GeocodeResult, JourneyPoint } from '../types';

interface AddressInputProps {
  label: string;
  value: JourneyPoint | null;
  onChange: (point: JourneyPoint | null) => void;
  allowGeolocation?: boolean;
}

export function AddressInput({ label, value, onChange, allowGeolocation }: AddressInputProps) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { suggestions, loading } = useGeocodeSuggestions(query);

  function selectSuggestion(result: GeocodeResult) {
    setQuery(result.displayName);
    setOpen(false);
    onChange({ coordinates: { lat: result.lat, lon: result.lon } });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      setQuery('Ma position actuelle');
      setOpen(false);
      onChange({ coordinates: { lat: latitude, lon: longitude } });
    });
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 focus-within:border-[#1E3A5F] dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-[#3B6EA5]">
        <MapPin className="shrink-0 text-zinc-400" size={18} />
        <input
          id={inputId}
          type="text"
          value={query}
          placeholder="Adresse, lieu…"
          className="h-11 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {allowGeolocation && (
          <button
            type="button"
            onClick={useCurrentLocation}
            aria-label="Utiliser ma position actuelle"
            className="shrink-0 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-[#1E3A5F] dark:hover:bg-zinc-800 dark:hover:text-[#3B6EA5]"
          >
            <NavigationArrow size={16} weight="fill" />
          </button>
        )}
      </div>

      {open && (loading || suggestions.length > 0) && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {loading && (
            <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Recherche…</li>
          )}
          {!loading &&
            suggestions.map((result) => (
              <li key={`${result.lat}-${result.lon}`}>
                <button
                  type="button"
                  onMouseDown={() => selectSuggestion(result)}
                  className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {result.displayName}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
