import { apiFetch } from '@/src/lib/api-client';

export function deleteSavedJourney(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/journeys/saved/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
