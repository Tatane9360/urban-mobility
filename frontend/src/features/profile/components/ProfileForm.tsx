'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Plus, Trash, Bicycle, PersonSimpleWalk, Train, Bus } from '@phosphor-icons/react/dist/ssr';
import { geocode } from '../../journey-planner/api/geocode';
import { useGeocodeSuggestions } from '../../journey-planner/hooks/useGeocodeSuggestions';
import { TransportMode, type Profile } from '../types';

const MODE_OPTIONS: { mode: TransportMode; label: string; icon: typeof Train }[] = [
  { mode: TransportMode.Marche, label: 'Marche', icon: PersonSimpleWalk },
  { mode: TransportMode.Velo, label: 'Vélo', icon: Bicycle },
  { mode: TransportMode.Bus, label: 'Bus', icon: Bus },
  { mode: TransportMode.Tram, label: 'Tram', icon: Train },
];

interface ProfileFormProps {
  profile: Profile;
  saving: boolean;
  // Outcome of the last save, so the form can confirm or explain rather than
  // dropping silently back to rest.
  saved: boolean;
  error: string | null;
  onSave: (update: { preferredModes: TransportMode[]; favoriteAddresses: string[] }) => void;
}

export function ProfileForm({ profile, saving, saved, error, onSave }: ProfileFormProps) {
  const addressId = useId();
  const listId = `${addressId}-suggestions`;
  const [preferredModes, setPreferredModes] = useState(profile.preferredModes);
  const [favoriteAddresses, setFavoriteAddresses] = useState(profile.favoriteAddresses);
  const [newAddress, setNewAddress] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  // Same geocoder the planner uses: an address saved here that it cannot
  // resolve is dead weight the user only discovers back on the planner.
  const { suggestions, loading: suggesting } = useGeocodeSuggestions(newAddress);
  const [open, setOpen] = useState(false);
  const [rawActiveIndex, setActiveIndex] = useState(-1);
  const activeIndex = rawActiveIndex < suggestions.length ? rawActiveIndex : -1;
  const holdingRef = useRef(false);
  const popupOpen = open && (suggesting || suggestions.length > 0);

  // Dirty tracking: the form holds a draft, and leaving used to discard it
  // with no warning at all.
  const dirty =
    preferredModes.join() !== profile.preferredModes.join() ||
    favoriteAddresses.join('\u0000') !== profile.favoriteAddresses.join('\u0000');

  // Covers tab close and reload. ponytail: in-app navigation is guarded by the
  // visible "Modifications non enregistrees" flag rather than by intercepting
  // the App Router — swap to a router guard if silent in-app loss shows up.
  useEffect(() => {
    if (!dirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function toggleMode(mode: TransportMode) {
    setPreferredModes((current) =>
      current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode],
    );
  }

  // Only a geocodable address gets stored, and never twice.
  function addAddress(label?: string) {
    const trimmed = (label ?? newAddress).trim();
    if (!trimmed) return;
    if (favoriteAddresses.includes(trimmed)) {
      setAddressError('Cette adresse est déjà dans vos favoris.');
      return;
    }
    setFavoriteAddresses((current) => [...current, trimmed]);
    setNewAddress('');
    setAddressError(null);
    setOpen(false);
    setActiveIndex(-1);
  }

  // Typing an address and pressing Add without picking a suggestion resolves
  // it against the geocoder rather than storing free text.
  async function commitTypedAddress() {
    const trimmed = newAddress.trim();
    if (!trimmed) return;
    // The suggestions are debounced, so a fast click can land before they
    // arrive. Resolving directly here means Add never silently does nothing.
    const best = suggesting ? (await geocode(trimmed))[0] : suggestions[0];
    if (!best) {
      setAddressError('Adresse introuvable. Précisez-la ou choisissez une suggestion.');
      return;
    }
    addAddress(best.displayName);
  }

  function handleAddressKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = activeIndex + step;
      setActiveIndex(next < 0 ? suggestions.length - 1 : next >= suggestions.length ? 0 : next);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const picked = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (picked) addAddress(picked.displayName);
      else void commitTypedAddress();
    }
  }

  function removeAddress(index: number) {
    setFavoriteAddresses((current) => current.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ preferredModes, favoriteAddresses });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Modes de transport préférés
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODE_OPTIONS.map(({ mode, label, icon: Icon }) => {
            const active = preferredModes.includes(mode);
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => toggleMode(mode)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors ${
                  active
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700'
                }`}
              >
                <Icon size={20} weight="bold" />
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Adresses favorites
        </legend>

        {favoriteAddresses.length === 0 && (
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Aucune adresse enregistrée. Ajoutez votre domicile ou votre travail pour les
            retrouver plus vite dans le planificateur.
          </p>
        )}

        {favoriteAddresses.length > 0 && (
          <ul className="mb-3 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {favoriteAddresses.map((address, index) => (
              <li key={`${address}-${index}`} className="flex items-center justify-between gap-2 py-2">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{address}</span>
                <button
                  type="button"
                  onClick={() => removeAddress(index)}
                  aria-label={`Retirer ${address}`}
                  className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                >
                  <Trash size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <label htmlFor={addressId} className="sr-only">
          Ajouter une adresse favorite
        </label>
        <div className="relative">
          <div className="flex gap-2">
            <input
              id={addressId}
              type="text"
              value={newAddress}
              role="combobox"
              aria-expanded={popupOpen}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
              aria-invalid={addressError ? true : undefined}
              aria-errormessage={addressError ? `${addressId}-error` : undefined}
              onChange={(e) => {
                setNewAddress(e.target.value);
                setOpen(true);
                if (addressError) setAddressError(null);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleAddressKeyDown}
              onBlur={() => {
                if (holdingRef.current) return;
                setOpen(false);
                setActiveIndex(-1);
              }}
              placeholder="Ajouter une adresse…"
              className="h-10 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-accent dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="button"
              onClick={() => void commitTypedAddress()}
              aria-label="Ajouter cette adresse"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:border-accent hover:text-accent dark:border-zinc-800 dark:text-zinc-400"
            >
              <Plus size={16} weight="bold" />
            </button>
          </div>

          {popupOpen && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Suggestions d&apos;adresses"
              onMouseDown={() => {
                holdingRef.current = true;
              }}
              onMouseUp={() => {
                holdingRef.current = false;
              }}
              className="absolute z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              {suggesting && (
                <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Recherche…</li>
              )}
              {!suggesting &&
                suggestions.map((result, index) => (
                  <li
                    key={`${result.lat}-${result.lon}`}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseDown={() => addAddress(result.displayName)}
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

        {addressError && (
          <p id={`${addressId}-error`} role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-400">
            {addressError}
          </p>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="h-11 self-start rounded-lg bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {/* Without this the save was imperceptible: the label returned to rest
            whether it succeeded or failed. */}
        <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
          {saved && !saving && !dirty ? 'Préférences enregistrées.' : ''}
        </p>
        {dirty && !saving && (
          <p className="text-sm text-amber-700 dark:text-amber-400">Modifications non enregistrées</p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </form>
  );
}
