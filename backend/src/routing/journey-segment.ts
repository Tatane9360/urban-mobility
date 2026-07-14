import { TransportMode } from '../common/transport-mode.enum';
import { OrsStep } from '../integration/openrouteservice.types';
import { GeoPoint } from './geo-point';

export type JourneyStep = OrsStep;

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
  // Bus/Tram only — the GTFS line and its direction, straight from
  // gtfs_route/gtfs_trip. Absent for Marche/Vélo, which have neither.
  routeShortName?: string | null;
  tripHeadsign?: string | null;
  // Marche/Vélo only — turn-by-turn from OpenRouteService, in the order
  // walked/ridden. Absent for Bus/Tram (a transit line has no such steps —
  // the rider follows the vehicle, not directions) and absent whenever ORS
  // was unreachable and the provider fell back to the straight-line estimate.
  steps?: JourneyStep[];
  // Marche/Vélo only — the real road/path polyline from OpenRouteService, in
  // travel order. Same absence conditions as `steps`. Bus/Tram segments keep
  // drawing as a straight from/to line — GTFS carries stop pairs, not a
  // per-segment shape, and OpenRouteService has no "follow this transit
  // line" profile (see the Haversine-distance comment on distanceMeters).
  geometry?: JourneyWaypoint[];
}

export interface CarbonedJourneySegment extends RawJourneySegment {
  carbonGrams: number;
}

export interface JourneySegment extends CarbonedJourneySegment {
  // Wall-clock start/end, derived by the planner from cumulative segment
  // durations off the search's departureTime — not sourced from GTFS
  // stop_times directly, so Marche/Vélo segments get one too.
  startTime: string;
  endTime: string;
}

export function toWaypoint(point: GeoPoint, name: string): JourneyWaypoint {
  return { name, lat: point.lat, lon: point.lon };
}
