import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { listSavedJourneys } from '../api/list-saved-journeys';
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

  return { journeys, loading: token !== null && !fetched };
}
