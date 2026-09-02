'use client';

import { useSyncExternalStore } from 'react';
import { NavigationArrow } from '@phosphor-icons/react/dist/ssr';
import {
  notifyConsentChanged,
  readConsent,
  subscribeToConsent,
  writeConsent,
  type GeolocationConsent,
} from '../../journey-planner/geolocation-consent';

// Makes the geolocation consent revocable, as the PRD requires for sensitive
// data. The choice is per-browser (localStorage), never sent to the server, so
// there is nothing to revoke server side.
export function GeolocationConsentSection() {
  // localStorage doesn't exist during SSR, so the stored value can only be
  // read on the client. useSyncExternalStore renders the server snapshot
  // (null) then the real one after hydration, without a setState-in-effect.
  const consent = useSyncExternalStore<GeolocationConsent>(
    subscribeToConsent,
    readConsent,
    // Server snapshot: localStorage doesn't exist there, and "never asked" is
    // the honest answer until the client hydrates.
    () => null,
  );

  function update(next: GeolocationConsent) {
    writeConsent(next);
    notifyConsentChanged();
  }

  return (
    // Flat, like the modes/favorites fieldsets above — a card here gave a
    // localStorage-only, easily-reversed preference more visual weight than
    // the sections the user actually came to manage. DESIGN.md reserves
    // elevation for where it carries real hierarchy.
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <NavigationArrow size={16} weight="fill" className="text-zinc-400" />
        Géolocalisation
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {consent === 'granted'
          ? 'Vous avez autorisé UrbanFlow à utiliser votre position. Elle reste sur cet appareil.'
          : consent === 'denied'
            ? 'Vous avez refusé l’accès à votre position. Le bouton « ma position » vous le redemandera.'
            : 'Votre position n’a jamais été demandée sur cet appareil.'}
      </p>
      {consent !== null && (
        <button
          type="button"
          onClick={() => update(null)}
          className="mt-3 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Revenir sur ce choix
        </button>
      )}
    </section>
  );
}
