import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { listSavedJourneys } from '../api/list-saved-journeys';
import { deleteSavedJourney } from '../api/delete-saved-journey';
import { readCachedJourneys, writeCachedJourneys } from '../offline-cache';
import type { SavedJourney } from '../types';

export function useSavedJourneys() {
  const { token } = useAuth();
  // Seeded from the local copy so the list is on screen at first paint,
  // before any request resolves (and instead of a setState in the effect).
  const [journeys, setJourneys] = useState<SavedJourney[]>(
    () => readCachedJourneys() ?? [],
  );
  const [fetched, setFetched] = useState(false);
  // True once a request has failed and the list on screen comes from the
  // local copy — the page says so rather than pretending it is live.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!token) return;
    // Stale-while-revalidate: the cached list is already on screen (seeded
    // above), the request then replaces it. Offline it never resolves and the
    // cache is all there is.
    listSavedJourneys(token)
      .then((fresh) => {
        setJourneys(fresh);
        setOffline(false);
        writeCachedJourneys(fresh);
      })
      .catch(() => setOffline(true))
      .finally(() => setFetched(true));
  }, [token]);

  async function remove(id: string) {
    if (!token) return;
    await deleteSavedJourney(token, id);
    setJourneys((current) => {
      const next = current.filter((journey) => journey.id !== id);
      // Keep the offline copy in step, or a deleted journey reappears on the
      // next offline visit.
      writeCachedJourneys(next);
      return next;
    });
  }

  return { journeys, loading: token !== null && !fetched, offline, remove };
}
