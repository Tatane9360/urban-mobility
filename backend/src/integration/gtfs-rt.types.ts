export interface VehiclePosition {
  vehicleId: string;
  tripId: string | null;
  routeId: string | null;
  lat: number;
  lon: number;
  bearing: number | null;
  speed: number | null;
  timestamp: Date;
}

// One TripUpdate.StopTimeUpdate, flattened: the delay in seconds against the
// static GTFS schedule for one stop of one trip. Keyed in the snapshot by
// `tripId|stopId` (see tripStopKey) — the pair GTFS-RT itself uses to address
// a stop event.
export interface TripStopDelay {
  tripId: string;
  stopId: string;
  delaySeconds: number;
}

// One ServiceAlert entity, reduced to what the UI needs: which routes it hits
// and the FR text.
// informedEntity is flattened to routeIds only: GTFS-RT also carries
// stop/trip/agency selectors, but the UI badges a segment by its line. To
// support them, add the fields here and widen JourneyPlannerService's matching.
export interface ServiceAlert {
  id: string;
  routeIds: string[];
  header: string;
  description: string;
  // Absent bounds mean "no start"/"no end" per the spec, kept as null.
  activeFrom: Date | null;
  activeUntil: Date | null;
}

export interface GtfsRtSnapshot {
  vehicles: VehiclePosition[];
  // tripId|stopId -> delay. A Map, not an array: BusTramMobilityProvider does
  // one point lookup per candidate segment.
  delays: Map<string, TripStopDelay>;
  alerts: ServiceAlert[];
  fetchedAt: Date;
}

export function tripStopKey(tripId: string, stopId: string): string {
  return `${tripId}|${stopId}`;
}
