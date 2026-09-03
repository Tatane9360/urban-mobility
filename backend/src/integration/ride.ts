// A ride on one transit line between two of its stops, as the static GTFS feed
// describes it: which line, which stops, at what theoretical times. The unit
// GtfsScheduleRepository hands back, and the shape BusTramMobilityProvider
// turns into a Journey Segment once GTFS-RT delays are applied.
//
// Deliberately free of GTFS spelling — no route_type, no "08:30:00" strings,
// no stop_sequence. Those stay behind the repository's seam.

export interface RideStop {
  name: string;
  lat: number;
  lon: number;
}

export interface RideEndpoint extends RideStop {
  // The GTFS stop_id, kept because it is half the key GTFS-RT publishes its
  // delays under (the other half being tripId).
  stopId: string;
}

export interface Ride {
  // The GTFS trip_id: the other half of the GTFS-RT delay key.
  tripId: string;
  // The GTFS route_id, which GTFS-RT's informedEntity names when matching a
  // ServiceAlert. Distinct from routeShortName, the human label ("1", "L2").
  routeId: string;
  routeShortName: string | null;
  tripHeadsign: string | null;
  // route_type resolved to the domain's own distinction. GTFS's 0 = Tram, and
  // everything else TaM publishes (3 = Bus, 715 = shuttle bus) is a Bus — see
  // CONTEXT.md, which folds 715 into Bus.
  isTram: boolean;
  boarding: RideEndpoint;
  alighting: RideEndpoint;
  // Seconds past midnight on the searched calendar day, not a wall-clock
  // instant: GTFS's >24:00:00 overnight convention survives as a value past
  // 86400 instead of being clamped. The caller turns these into real times.
  scheduledDepartureSeconds: number;
  scheduledArrivalSeconds: number;
  // The stops this ride actually serves between boarding and alighting,
  // inclusive, in travel order. Absent when the two are consecutive — the
  // chord is then already the whole line.
  servedStops?: RideStop[];
}
