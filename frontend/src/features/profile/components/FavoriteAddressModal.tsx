'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { House, Briefcase } from '@phosphor-icons/react/dist/ssr';
import { geocode } from '../../journey-planner/api/geocode';
import { useGeocodeSuggestions } from '../../journey-planner/hooks/useGeocodeSuggestions';
import type { FavoriteAddress } from '../types';

// Fixed to these two, per the brief: a favorite here is Maison or Travail,
// nothing else. The free-text label field this replaced is gone with it.
const KINDS: { label: string; icon: typeof House }[] = [
  { label: 'Maison', icon: House },
  { label: 'Travail', icon: Briefcase },
];

interface FavoriteAddressModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (favorite: FavoriteAddress) => void;
  // Which of Maison/Travail are already taken, so the modal can't produce a
  // label collision the parent would otherwise have to reject after the fact.
  takenLabels: string[];
}

export function FavoriteAddressModal({ open, onClose, onAdd, takenLabels }: FavoriteAddressModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addressId = useId();
  const listId = `${addressId}-suggestions`;

  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { suggestions, loading: suggesting } = useGeocodeSuggestions(address);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [rawActiveIndex, setActiveIndex] = useState(-1);
  const activeIndex = rawActiveIndex < suggestions.length ? rawActiveIndex : -1;
  const holdingRef = useRef(false);
  const popupOpen = suggestionsOpen && (suggesting || suggestions.length > 0);

  // <dialog> owns its own open/closed state; this mirrors the `open` prop
  // into it rather than controlling visibility with CSS, so Escape, the
  // backdrop, and focus-trapping all come from the platform for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // No reset effect here: ProfileForm keys this component on its open state,
  // so each opening mounts a fresh instance and every useState above starts
  // at its initial value.

  function commit(resolvedAddress: string) {
    if (!selectedKind) {
      setError('Choisissez Maison ou Travail.');
      return;
    }
    onAdd({ label: selectedKind, address: resolvedAddress });
  }

  function selectSuggestion(displayName: string) {
    setAddress(displayName);
    setSuggestionsOpen(false);
    setActiveIndex(-1);
    commit(displayName);
  }

  // Typing an address and confirming without picking a suggestion resolves
  // it against the geocoder rather than storing free text, same as the
  // planner's own address fields.
  async function commitTyped() {
    const trimmed = address.trim();
    if (!trimmed) {
      setError('Saisissez une adresse.');
      return;
    }
    const best = suggesting ? (await geocode(trimmed))[0] : suggestions[0];
    if (!best) {
      setError('Adresse introuvable. Précisez-la ou choisissez une suggestion.');
      return;
    }
    selectSuggestion(best.displayName);
  }

  function handleAddressKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setSuggestionsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setSuggestionsOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = activeIndex + step;
      setActiveIndex(next < 0 ? suggestions.length - 1 : next >= suggestions.length ? 0 : next);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const picked = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (picked) selectSuggestion(picked.displayName);
      else void commitTyped();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      // dialog::backdrop cannot be reached by a Tailwind utility, so its fade
      // lives in globals.css alongside this one's keyframes.
      className="m-auto w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 text-left shadow-lg backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-900 [&[open]]:animate-[modal-in_150ms_ease-out]"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Ajouter une adresse favorite</h2>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {KINDS.map(({ label: kindLabel, icon: Icon }) => {
          const taken = takenLabels.includes(kindLabel);
          const selected = selectedKind === kindLabel;
          return (
            <button
              key={kindLabel}
              type="button"
              disabled={taken}
              aria-pressed={selected}
              onClick={() => {
                setSelectedKind(kindLabel);
                if (error) setError(null);
              }}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors ${
                selected
                  ? 'border-accent bg-accent/5 text-accent'
                  : taken
                    ? 'cursor-not-allowed border-zinc-100 text-zinc-300 dark:border-zinc-800/60 dark:text-zinc-700'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700'
              }`}
            >
              <Icon size={20} weight="bold" />
              {kindLabel}
              {taken && <span className="text-xs">déjà enregistré</span>}
            </button>
          );
        })}
      </div>

      <label htmlFor={addressId} className="mb-1.5 mt-4 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Adresse
      </label>
      <div className="relative">
        <input
          id={addressId}
          type="text"
          value={address}
          role="combobox"
          aria-expanded={popupOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-errormessage={error ? `${addressId}-error` : undefined}
          onChange={(e) => {
            setAddress(e.target.value);
            setSuggestionsOpen(true);
            if (error) setError(null);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onKeyDown={handleAddressKeyDown}
          onBlur={() => {
            if (holdingRef.current) return;
            setSuggestionsOpen(false);
            setActiveIndex(-1);
          }}
          placeholder="1 rue de la Loge, Montpellier…"
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-accent dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
        />

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
            className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
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
                  onMouseDown={() => selectSuggestion(result.displayName)}
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

      {error && (
        <p id={`${addressId}-error`} role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => void commitTyped()}
          className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Ajouter
        </button>
      </div>
    </dialog>
  );
}
