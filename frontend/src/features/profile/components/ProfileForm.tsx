'use client';

import { useState } from 'react';
import { Plus, Trash, Bicycle, PersonSimpleWalk, Train, Bus } from '@phosphor-icons/react/dist/ssr';
import { FavoriteAddressModal } from './FavoriteAddressModal';
import { ConfirmModal } from './ConfirmModal';
import { TransportMode, type FavoriteAddress, type Profile } from '../types';

const MODE_OPTIONS: { mode: TransportMode; label: string; icon: typeof Train }[] = [
  { mode: TransportMode.Marche, label: 'Marche', icon: PersonSimpleWalk },
  { mode: TransportMode.Velo, label: 'Vélo', icon: Bicycle },
  { mode: TransportMode.Bus, label: 'Bus', icon: Bus },
  { mode: TransportMode.Tram, label: 'Tram', icon: Train },
];

interface ProfileFormProps {
  profile: Profile;
  saving: boolean;
  error: string | null;
  onSave: (update: { preferredModes: TransportMode[]; favoriteAddresses: FavoriteAddress[] }) => void;
}

// Every control here saves immediately — no draft state, no dirty flag.
// `profile` is the only source of truth; each handler sends the next value
// straight through onSave, and the parent's useProfile.save() swaps `profile`
// for the server's response once it lands.
export function ProfileForm({ profile, saving, error, onSave }: ProfileFormProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);

  function toggleMode(mode: TransportMode) {
    const next = profile.preferredModes.includes(mode)
      ? profile.preferredModes.filter((m) => m !== mode)
      : [...profile.preferredModes, mode];
    onSave({ preferredModes: next, favoriteAddresses: profile.favoriteAddresses });
  }

  function addFavorite(favorite: FavoriteAddress) {
    setModalOpen(false);
    onSave({ preferredModes: profile.preferredModes, favoriteAddresses: [...profile.favoriteAddresses, favorite] });
  }

  function confirmRemove() {
    if (pendingRemoveIndex === null) return;
    const next = profile.favoriteAddresses.filter((_, i) => i !== pendingRemoveIndex);
    setPendingRemoveIndex(null);
    onSave({ preferredModes: profile.preferredModes, favoriteAddresses: next });
  }

  const pendingFavorite = pendingRemoveIndex !== null ? profile.favoriteAddresses[pendingRemoveIndex] : null;

  return (
    <div className="flex flex-col gap-8">
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Modes de transport préférés
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODE_OPTIONS.map(({ mode, label, icon: Icon }) => {
            const active = profile.preferredModes.includes(mode);
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                disabled={saving}
                onClick={() => toggleMode(mode)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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

        {profile.favoriteAddresses.length === 0 && (
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Aucune adresse enregistrée. Ajoutez votre domicile ou votre travail pour les
            retrouver plus vite dans le planificateur.
          </p>
        )}

        {profile.favoriteAddresses.length > 0 && (
          <ul className="mb-3 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {profile.favoriteAddresses.map((favorite, index) => (
              <li key={`${favorite.label}-${index}`} className="flex items-center justify-between gap-2 py-2">
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{favorite.label}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{favorite.address}</span>
                </span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setPendingRemoveIndex(index)}
                  aria-label={`Retirer ${favorite.label}`}
                  className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                >
                  <Trash size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={() => setModalOpen(true)}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-600 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-400"
        >
          <Plus size={16} weight="bold" />
          Ajouter une adresse
        </button>

        <FavoriteAddressModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onAdd={addFavorite}
          takenLabels={profile.favoriteAddresses.map((f) => f.label)}
        />

        <ConfirmModal
          open={pendingFavorite !== null}
          title={`Retirer ${pendingFavorite?.label} ?`}
          message={`«${pendingFavorite?.address}» sera retirée de vos adresses favorites.`}
          confirmLabel="Retirer"
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemoveIndex(null)}
        />
      </fieldset>

      {/* Without this the save was imperceptible: nothing said whether the
          last click actually landed. */}
      <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
        {saving ? 'Enregistrement…' : ''}
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}
