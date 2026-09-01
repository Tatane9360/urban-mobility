import { useRef, useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { planJourney } from '../api/plan-journey';
import { ApiError } from '@/src/lib/api-client';
import type { Journey, JourneyPoint, JourneySortCriterion } from '../types';

interface PlanState {
  journeys: Journey[];
  loading: boolean;
  error: string | null;
}

export function useJourneyPlanner() {
  // Passed through to the planner so a signed-in user's preferred modes rank
  // the results; null for a guest, which the backend handles as anonymous.
  const { token } = useAuth();
  const [state, setState] = useState<PlanState>({ journeys: [], loading: false, error: null });
  const [sort, setSort] = useState<JourneySortCriterion>('duration');
  // Kept so a failed search can be replayed without making the user retype
  // both addresses — the usual case on mobile, where the network drops.
  const lastArgs = useRef<Parameters<typeof search> | null>(null);

  async function search(
    origin: JourneyPoint,
    destination: JourneyPoint,
    departureTime?: string,
    // Explicit so a criterion change can replay immediately, instead of
    // reading the `sort` this closure captured before setSort re-rendered.
    criterion: JourneySortCriterion = sort,
  ): Promise<Journey[]> {
    lastArgs.current = [origin, destination, departureTime, criterion];
    setState({ journeys: [], loading: true, error: null });
    try {
      const journeys = await planJourney({ origin, destination, sort: criterion, departureTime }, token);
      setState({ journeys, loading: false, error: null });
      return journeys;
    } catch (err) {
      // A planned journey needs the network — nothing useful is cached for a
      // route never searched before. Say so plainly instead of blaming the
      // server: offline, fetch rejects with a TypeError, not an ApiError.
      const message = err instanceof ApiError
        ? err.message
        : typeof navigator !== 'undefined' && !navigator.onLine
          ? 'Vous êtes hors ligne : impossible de calculer un nouvel itinéraire.'
          : "Impossible de calculer un itinéraire pour le moment.";
      setState({ journeys: [], loading: false, error: message });
      return [];
    }
  }

  // Replays the last search. Reading the ref happens on click, not during
  // render; a retry before any search has run is simply a no-op.
  function retry() {
    const args = lastArgs.current;
    if (args) void search(...args);
  }

  // Changing the criterion re-runs the search, because the ordering is the
  // backend's: it ranks preferred modes first, then sorts. Before any search
  // this only stores the choice.
  function changeSort(next: JourneySortCriterion) {
    setSort(next);
    const args = lastArgs.current;
    if (args) void search(args[0], args[1], args[2], next);
  }

  return { ...state, sort, setSort: changeSort, search, retry };
}
