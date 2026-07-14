'use client';

import { useState } from 'react';
import { Plus, Trash, Bicycle, PersonSimpleWalk, Train, Bus } from '@phosphor-icons/react/dist/ssr';
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
  onSave: (update: { preferredModes: TransportMode[]; favoriteAddresses: string[] }) => void;
}

export function ProfileForm({ profile, saving, onSave }: ProfileFormProps) {
  const [preferredModes, setPreferredModes] = useState(profile.preferredModes);
  const [favoriteAddresses, setFavoriteAddresses] = useState(profile.favoriteAddresses);
  const [newAddress, setNewAddress] = useState('');

  function toggleMode(mode: TransportMode) {
    setPreferredModes((current) =>
      current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode],
    );
  }

  function addAddress() {
    const trimmed = newAddress.trim();
    if (!trimmed) return;
    setFavoriteAddresses((current) => [...current, trimmed]);
    setNewAddress('');
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
                    ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F] dark:border-[#3B6EA5] dark:bg-[#3B6EA5]/10 dark:text-[#3B6EA5]'
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

        <div className="flex gap-2">
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addAddress();
              }
            }}
            placeholder="Ajouter une adresse…"
            className="h-10 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[#1E3A5F] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-[#3B6EA5]"
          />
          <button
            type="button"
            onClick={addAddress}
            aria-label="Ajouter cette adresse"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:border-[#1E3A5F] hover:text-[#1E3A5F] dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-[#3B6EA5] dark:hover:text-[#3B6EA5]"
          >
            <Plus size={16} weight="bold" />
          </button>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={saving}
        className="h-11 self-start rounded-lg bg-[#1E3A5F] px-5 text-sm font-medium text-white transition-colors hover:bg-[#16293F] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#3B6EA5] dark:hover:bg-[#4E82BA]"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  );
}
