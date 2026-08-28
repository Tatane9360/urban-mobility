// Mirrors backend/src/common/transport-mode.enum.ts
export enum TransportMode {
  Tram = 'Tram',
  Bus = 'Bus',
  Velo = 'Vélo',
  Marche = 'Marche',
}

// Mirrors backend/src/routing/dto/plan-journey.dto.ts
export type JourneySortCriterion = 'duration' | 'carbon';

export interface Coordinates {
  lat: number;
  lon: number;
}

// Exactly one of coordinates/address must be set, same contract as
// backend/src/routing/dto/journey-point.dto.ts.
export interface JourneyPoint {
  coordinates?: Coordinates;
  address?: string;
}

export interface PlanJourneyRequest {
  origin: JourneyPoint;
  destination: JourneyPoint;
  sort?: JourneySortCriterion;
}

// Mirrors backend/src/routing/journey-segment.ts
export interface JourneyWaypoint {
  name: string;
  lat: number;
  lon: number;
}

// Mirrors backend/src/integration/openrouteservice.types.ts's OrsStep.
export interface JourneyStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  type: number;
  location: Coordinates;
}

export interface JourneySegment {
  mode: TransportMode;
  durationSeconds: number;
  distanceMeters: number;
  from: JourneyWaypoint;
  to: JourneyWaypoint;
  carbonGrams: number;
  // Bus/Tram only — GTFS line and direction.
  routeShortName?: string | null;
  tripHeadsign?: string | null;
  // Bus/Tram only — GTFS route_id, the key ServiceAlerts are matched on.
  routeId?: string | null;
  // Bus/Tram only — GTFS-RT TripUpdate applied to this segment. realtime is
  // false when the trip wasn't in the feed (or the feed was stale), in which
  // case delaySeconds is 0 and the times shown are theoretical.
  realtime?: boolean;
  delaySeconds?: number;
  // Bus/Tram only — active disruptions on this segment's route.
  alerts?: ServiceAlert[];
  // Marche/Vélo only — turn-by-turn, absent when ORS was unreachable.
  steps?: JourneyStep[];
  // Marche/Vélo only — the real road/path polyline, in travel order. Absent
  // for Bus/Tram (no per-segment shape in GTFS) and when ORS was unreachable.
  geometry?: JourneyWaypoint[];
  startTime: string;
  endTime: string;
}

// Mirrors backend/src/carbon/emission-factor.ts
export interface CarComparison {
  carCarbonGrams: number;
  savedCarbonGrams: number;
  savedPercent: number;
}

// Mirrors backend/src/integration/gtfs-rt.types.ts
export interface ServiceAlert {
  id: string;
  routeIds: string[];
  header: string;
  description: string;
  // ISO strings over the wire; null means "no bound" per GTFS-RT.
  activeFrom: string | null;
  activeUntil: string | null;
}

// Mirrors backend/src/routing/journey.ts
export interface Journey {
  segments: JourneySegment[];
  durationSeconds: number;
  carbonGrams: number;
  carComparison: CarComparison;
  degraded: boolean;
}

// Mirrors backend/src/integration/geocoding.types.ts
export interface GeocodeResult {
  displayName: string;
  lat: number;
  lon: number;
}
