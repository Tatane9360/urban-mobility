import { OpenRouteService } from '../../src/integration/openrouteservice.service';
import {
  OrsProfile,
  OrsRoute,
} from '../../src/integration/openrouteservice.types';
import { GeoPoint } from '../../src/routing/geo-point';
import { haversineDistanceMeters } from '../../src/routing/geo-distance';

// Speeds roughly matching what ORS returns for these profiles, so a stubbed
// duration stays plausible against the real thing.
const SPEED_METERS_PER_SECOND: Record<OrsProfile, number> = {
  'foot-walking': 1.4,
  'cycling-regular': 4.2,
};

// OpenRouteService is a live third-party API on a daily quota, and the planner
// calls it several times per search (an approach walk, an exit walk, the bike
// leg). A full e2e run burned through hundreds of requests and exhausted the
// free plan, which then degraded every route to a straight line — including in
// the browser. Tests get this stub instead; the real service keeps its own
// unit tests (openrouteservice.service.spec.ts) where fetch itself is mocked.
//
// ponytail: straight line between the two points, not a road-following shape.
// The tests here assert that a geometry is present and used, never its exact
// path — reproducing real street routing offline would mean shipping a routing
// engine. Swap in a recorded ORS response if a test ever needs a real polyline.
export function openRouteServiceStub(): Pick<OpenRouteService, 'getRoute'> {
  return {
    getRoute: (
      from: GeoPoint,
      to: GeoPoint,
      profile: OrsProfile,
    ): Promise<OrsRoute | null> => {
      const distanceMeters = haversineDistanceMeters(from, to);
      return Promise.resolve({
        distanceMeters,
        durationSeconds: Math.round(
          distanceMeters / SPEED_METERS_PER_SECOND[profile],
        ),
        steps: [
          {
            instruction: 'Continuer tout droit',
            distanceMeters,
            durationSeconds: Math.round(
              distanceMeters / SPEED_METERS_PER_SECOND[profile],
            ),
            // 11 = "head straight" in ORS's own maneuver codes.
            type: 11,
            location: { lat: to.lat, lon: to.lon },
          },
        ],
        geometry: [
          { lat: from.lat, lon: from.lon },
          { lat: to.lat, lon: to.lon },
        ],
      });
    },
  };
}
