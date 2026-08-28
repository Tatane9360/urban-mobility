import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { listSavedJourneys } from '../api/list-saved-journeys';
import { deleteSavedJourney } from '../api/delete-saved-journey';
import type { SavedJourney } from '../types';

export function useSavedJourneys() {
  const { token } = useAuth();
  const [journeys, setJourneys] = useState<SavedJourney[]>([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!token) return;
    listSavedJourneys(token)
      .then(setJourneys)
      .finally(() => setFetched(true));
  }, [token]);

  async function remove(id: string) {
    if (!token) return;
    await deleteSavedJourney(token, id);
    setJourneys((current) => current.filter((journey) => journey.id !== id));
  }

  return { journeys, loading: token !== null && !fetched, remove };
}
