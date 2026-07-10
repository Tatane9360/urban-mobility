import { TransportMode } from '../common/transport-mode.enum';
import { GeoPoint } from './geo-point';

// ponytail: "tracé" per CONTEXT.md's Journey Segment definition is captured
// here as the named waypoints actually used (the matched stop, not just the
// caller's raw search point) — a full route polyline is deferred to #12,
// which is the first ticket that will actually render a map.
export interface JourneyWaypoint extends GeoPoint {
  name: string;
}

// A MobilityProvider only knows mode/duration/tracé — carbon is attached
// afterwards by the planner (CarbonService), one calculation point instead of
// duplicating emission-factor lookups in every provider (see #13).
// distanceMeters is the provider's own real distance (OpenRouteService route
// length for Walk/Bike, Haversine between matched stops for Bus/Tram) — not
// re-derived from from/to via Haversine downstream, so carbon stays
// consistent with whatever distance actually produced the duration (see #16).
export interface RawJourneySegment {
  mode: TransportMode;
  durationSeconds: number;
  distanceMeters: number;
  from: JourneyWaypoint;
  to: JourneyWaypoint;
}

export interface JourneySegment extends RawJourneySegment {
  carbonGrams: number;
}

export function toWaypoint(point: GeoPoint, name: string): JourneyWaypoint {
  return { name, lat: point.lat, lon: point.lon };
}
