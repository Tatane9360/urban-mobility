import { apiFetch } from '@/src/lib/api-client';
import type { Journey, PlanJourneyRequest } from '../types';

export function planJourney(request: PlanJourneyRequest): Promise<Journey[]> {
  return apiFetch<Journey[]>('/journeys', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
