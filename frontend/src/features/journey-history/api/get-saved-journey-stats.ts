import { apiFetch } from '@/src/lib/api-client';
import type { SavedJourneyStats } from '../types';

export function getSavedJourneyStats(token: string): Promise<SavedJourneyStats> {
  return apiFetch<SavedJourneyStats>('/journeys/saved/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
