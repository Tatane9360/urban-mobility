import { apiFetch } from '@/src/lib/api-client';
import type { Journey } from '../types';

// The backend's ValidationPipe has whitelist:true (main.ts) — only the
// fields SaveJourneySegmentDto declares may be sent, so anything outside
// this list (steps, geometry, startTime…) must be stripped, not forwarded.
// distanceMeters IS declared, and GET /journeys/saved/stats needs it to
// rebuild the car baseline — dropping it would silently zero the CO₂ saved.
export function saveJourney(token: string, journey: Journey): Promise<void> {
  return apiFetch<void>('/journeys/saved', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      segments: journey.segments.map(
        ({ mode, durationSeconds, distanceMeters, carbonGrams, from, to }) => ({
          mode,
          durationSeconds,
          distanceMeters,
          carbonGrams,
          from,
          to,
        }),
      ),
      durationSeconds: journey.durationSeconds,
      carbonGrams: journey.carbonGrams,
      degraded: journey.degraded,
    }),
  });
}
