'use client';

import { useId, useRef, useState } from 'react';
import { Crosshair, MapPin, NavigationArrow } from '@phosphor-icons/react/dist/ssr';
import { useGeocodeSuggestions } from '../hooks/useGeocodeSuggestions';
import { readConsent, writeConsent } from '../geolocation-consent';
import type { GeocodeResult, JourneyPoint } from '../types';

interface AddressInputProps {
  label: string;
  value: JourneyPoint | null;
  onChange: (point: JourneyPoint | null) => void;
  allowGeolocation?: boolean;
  // "Pick on the map" mode: this field is armed and waiting for a map click.
  picking?: boolean;
  onTogglePick?: () => void;
  // Label to show when the point came from a map click — the geocoded and
  // geolocated paths set their own label locally.
  pickedLabel?: string | null;
  // Text typed but not yet resolved to a point, lifted so the form can
  // geocode it on submit instead of sitting behind a dead button.
  onQueryChange?: (query: string) => void;
  // Set by the form when submitting could not resolve this field.
  error?: string | null;
}

export function AddressInput({
  label,
  value,
  onChange,
  allowGeolocation,
  picking,
  onTogglePick,
  pickedLabel,
  onQueryChange,
  error,
}: AddressInputProps) {
  const inputId = useId();
  const listId = `${inputId}-suggestions`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { suggestions, loading } = useGeocodeSuggestions(picking ? '' : query);
  // Shown instead of locating, until the user has answered once.
  const [askingConsent, setAskingConsent] = useState(false);
  // Keyboard cursor into the suggestion list. -1 means "nothing highlighted";
  // this is a combobox popup, so focus itself never leaves the input.
  const [rawActiveIndex, setActiveIndex] = useState(-1);
  // A fresh set of suggestions can be shorter than the old cursor position, so
  // clamp during render rather than resetting from an effect.
  const activeIndex = rawActiveIndex < suggestions.length ? rawActiveIndex : -1;
  // Set while a pointer is down inside the list: blur must not close the popup
  // before the click lands, but a real blur (Tab away) still has to.
  const holdingRef = useRef(false);

  // A point picked on the map is owned by the parent, so its label is derived
  // rather than mirrored into state — typing clears the pick (onChange(null)
  // in the parent) and hands the box back to `query`.
  const displayed = pickedLabel ?? query;
  const popupOpen = open && (loading || suggestions.length > 0);

  function updateQuery(next: string) {
    setQuery(next);
    onQueryChange?.(next);
  }

  function selectSuggestion(result: GeocodeResult) {
    updateQuery(result.displayName);
    setOpen(false);
    setActiveIndex(-1);
    onChange({ coordinates: { lat: result.lat, lon: result.lon } });
  }

  // Arrow keys move a cursor through the popup, Enter commits it, Escape
  // closes. Without this the list is pointer-only, so a keyboard user can
  // never produce a JourneyPoint - the one thing that enables Rechercher.
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = activeIndex + step;
      setActiveIndex(next < 0 ? suggestions.length - 1 : next >= suggestions.length ? 0 : next);
      return;
    }
    if (e.key === 'Enter' && open && activeIndex >= 0) {
      // Only swallow the submit while the cursor sits on a suggestion, so
      // Enter still submits the form once an address has been chosen.
      e.preventDefault();
      const result = suggestions[activeIndex];
      if (result) selectSuggestion(result);
    }
  }

  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      updateQuery('Ma position actuelle');
      setOpen(false);
      setActiveIndex(-1);
      onChange({ coordinates: { lat: latitude, lon: longitude } });
    });
  }

  // The geolocation API is only ever reached through here: without a stored
  // "granted", the click opens the consent prompt and asks the browser for
  // nothing at all. Consent is read at click time rather than in an effect so
  // a revocation from /profile takes effect without a reload.
  function requestCurrentLocation() {
    if (readConsent() === 'granted') {
      locate();
      return;
    }
    setAskingConsent(true);
  }

  function answerConsent(granted: boolean) {
    writeConsent(granted ? 'granted' : 'denied');
    setAskingConsent(false);
    if (granted) locate();
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 focus-within:border-accent dark:border-zinc-800 dark:bg-zinc-900">
        <MapPin className="shrink-0 text-zinc-400" size={18} />
        <input
          id={inputId}
          type="text"
          value={displayed}
          placeholder="Adresse, lieu…"
          className="h-11 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          role="combobox"
          aria-expanded={popupOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-errormessage={error ? `${inputId}-error` : undefined}
          onChange={(e) => {
            updateQuery(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // A pointer press inside the list is not a real blur: the click
            // has not fired yet, and closing here would cancel it.
            if (holdingRef.current) return;
            setOpen(false);
            setActiveIndex(-1);
          }}
        />
        {onTogglePick && (
          <button
            type="button"
            onClick={onTogglePick}
            aria-pressed={picking ?? false}
            aria-label={`Choisir ${label} sur la carte`}
            className={`shrink-0 rounded-full p-2.5 transition-colors ${
              picking
                ? 'bg-accent text-white'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-accent dark:hover:bg-zinc-800'
            }`}
          >
            <Crosshair size={16} weight={picking ? 'fill' : 'regular'} />
          </button>
        )}
        {allowGeolocation && (
          <button
            type="button"
            onClick={requestCurrentLocation}
            aria-label="Utiliser ma position actuelle"
            className="shrink-0 rounded-full p-2.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-accent dark:hover:bg-zinc-800"
          >
            <NavigationArrow size={16} weight="fill" />
          </button>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {askingConsent && (
        <div
          role="dialog"
          aria-label="Consentement à la géolocalisation"
          className="mt-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-zinc-700 dark:text-zinc-300">
            Utiliser votre position pour remplir ce champ ? Elle reste sur cet appareil et
            n&apos;est jamais enregistrée sur nos serveurs. Vous pouvez revenir sur ce choix
            depuis votre profil.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => answerConsent(true)}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
            >
              Autoriser
            </button>
            <button
              type="button"
              onClick={() => answerConsent(false)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              Refuser
            </button>
          </div>
        </div>
      )}

      {popupOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`Suggestions pour ${label}`}
          onMouseDown={() => {
            holdingRef.current = true;
          }}
          onMouseUp={() => {
            holdingRef.current = false;
          }}
          className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          {loading && (
            <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Recherche…</li>
          )}
          {!loading &&
            suggestions.map((result, index) => (
              <li
                key={`${result.lat}-${result.lon}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={() => selectSuggestion(result)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 ${
                  index === activeIndex ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                }`}
              >
                {result.displayName}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
