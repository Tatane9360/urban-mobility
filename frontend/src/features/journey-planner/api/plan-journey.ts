import { apiFetch } from '@/src/lib/api-client';
import type { Journey, PlanJourneyRequest } from '../types';

// The token is optional on purpose: /journeys stays open to guests (F1
// guarantees the anonymous search). Sent when there is one, so the Mobility
// Profile can rank the results — without it the backend sees every search as
// anonymous and the preferences never apply.
export function planJourney(
  request: PlanJourneyRequest,
  token?: string | null,
): Promise<Journey[]> {
  return apiFetch<Journey[]>('/journeys', {
    method: 'POST',
    body: JSON.stringify(request),
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
}
