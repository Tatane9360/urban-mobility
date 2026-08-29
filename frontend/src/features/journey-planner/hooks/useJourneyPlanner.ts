import { useState } from 'react';
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

  async function search(
    origin: JourneyPoint,
    destination: JourneyPoint,
    departureTime?: string,
  ): Promise<Journey[]> {
    setState({ journeys: [], loading: true, error: null });
    try {
      const journeys = await planJourney({ origin, destination, sort, departureTime }, token);
      setState({ journeys, loading: false, error: null });
      return journeys;
    } catch (err) {
      // A planned journey needs the network — nothing useful is cached for a
      // route never searched before. Say so plainly instead of blaming the
      // server: offline, fetch rejects with a TypeError, not an ApiError.
      const message = err instanceof ApiError
        ? err.message
        : typeof navigator !== 'undefined' && !navigator.onLine
          ? 'Vous êtes hors ligne : impossible de calculer un nouvel itinéraire. Vos itinéraires enregistrés restent consultables.'
          : "Impossible de calculer un itinéraire pour le moment.";
      setState({ journeys: [], loading: false, error: message });
      return [];
    }
  }

  return { ...state, sort, setSort, search };
}
