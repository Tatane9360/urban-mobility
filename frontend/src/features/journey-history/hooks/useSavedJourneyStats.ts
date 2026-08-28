import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { getSavedJourneyStats } from '../api/get-saved-journey-stats';
import type { SavedJourneyStats } from '../types';

// ponytail: same shape as useSavedJourneys — fetch once per token, no cache
// layer. Both hooks refetch on mount; add a shared query cache only if
// /history starts making more than these two calls.
export function useSavedJourneyStats() {
  const { token } = useAuth();
  const [stats, setStats] = useState<SavedJourneyStats | null>(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!token) return;
    getSavedJourneyStats(token)
      .then(setStats)
      .finally(() => setFetched(true));
  }, [token]);

  return { stats, loading: token !== null && !fetched };
}
