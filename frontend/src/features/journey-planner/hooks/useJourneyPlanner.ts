import { useState } from 'react';
import { planJourney } from '../api/plan-journey';
import { ApiError } from '@/src/lib/api-client';
import type { Journey, JourneyPoint, JourneySortCriterion } from '../types';

interface PlanState {
  journeys: Journey[];
  loading: boolean;
  error: string | null;
}

export function useJourneyPlanner() {
  const [state, setState] = useState<PlanState>({ journeys: [], loading: false, error: null });
  const [sort, setSort] = useState<JourneySortCriterion>('duration');

  async function search(
    origin: JourneyPoint,
    destination: JourneyPoint,
    departureTime?: string,
  ): Promise<Journey[]> {
    setState({ journeys: [], loading: true, error: null });
    try {
      const journeys = await planJourney({ origin, destination, sort, departureTime });
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
