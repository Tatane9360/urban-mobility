import { apiFetch } from '@/src/lib/api-client';
import type { Journey } from '../types';

// The backend's ValidationPipe has whitelist:true (main.ts) — only the
// fields SaveJourneySegmentDto declares may be sent, so distanceMeters
// (present on JourneySegment) must be stripped, not forwarded as-is.
export function saveJourney(token: string, journey: Journey): Promise<void> {
  return apiFetch<void>('/journeys/saved', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      segments: journey.segments.map(({ mode, durationSeconds, carbonGrams, from, to }) => ({
        mode,
        durationSeconds,
        carbonGrams,
        from,
        to,
      })),
      durationSeconds: journey.durationSeconds,
      carbonGrams: journey.carbonGrams,
      degraded: journey.degraded,
    }),
  });
}
