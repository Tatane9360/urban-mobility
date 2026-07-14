import { apiFetch } from '@/src/lib/api-client';
import type { SavedJourney } from '../types';

export function listSavedJourneys(token: string): Promise<SavedJourney[]> {
  return apiFetch<SavedJourney[]>('/journeys/saved', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
