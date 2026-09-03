import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TransportMode } from '../common/transport-mode.enum';
import { GeoPoint } from './geo-point';
import { haversineDistanceMeters } from './geo-distance';
import { GtfsRtService } from '../integration/gtfs-rt.service';
import { tripStopKey } from '../integration/gtfs-rt.types';
import { RawJourneySegment } from './journey-segment';
import { MobilityProvider } from './mobility-provider';

// Urban Montpellier's GTFS stop spacing is a few hundred metres; 500m matches
// the radius the integration e2e's spatial query already uses.
const NEARBY_STOP_RADIUS_METERS = 500;

// Alternatives on a single line, never a chain of two with a correspondence:
// real transfers need a graph search over the network, out of scope here.
const MAX_DEPARTURES = 3;

// gtfs_calendar day columns indexed by Date.getDay() (0 = Sunday), so a trip is
// only proposed on a day its GTFS service runs.
//
// KNOWN GAP: calendar.txt only. calendar_dates.txt (holidays, one-off changes)
// is never imported, so a public holiday still resolves to ordinary weekday
// service. To fix: import it and add a NOT EXISTS (exception_type = 2) /
// EXISTS (exception_type = 1) pair against this same date.
const CALENDAR_DAY_COLUMNS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

interface CandidateRow {
  routeType: number;
  routeId: string;
  routeShortName: string | null;
  tripId: string;
  fromStopId: string;
  toStopId: string;
  tripHeadsign: string | null;
  departureTime: string;
  arrivalTime: string;
  fromStopName: string;
  fromLon: number;
  fromLat: number;
  toStopName: string;
  toLon: number;
  toLat: number;
  fromSequence: number;
  toSequence: number;
}

// One stop along a ride, used to draw the line through the stops it actually
// serves instead of a straight chord between boarding and alighting.
interface RideStopRow {
  tripId: string;
  stopSequence: number;
  name: string;
  lat: number;
  lon: number;
}

@Injectable()
export class BusTramMobilityProvider implements MobilityProvider {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly gtfsRtService: GtfsRtService,
  ) {}

  // Raw SQL because QueryBuilder cannot express PostGIS functions (ST_DWithin)
  // cleanly. Every caller-supplied value is a positional param, never
  // interpolated into the SQL text.
  async getSegments(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<RawJourneySegment[]> {
    const departureTimeOfDay = toGtfsTimeOfDay(departureTime);
    // The one value interpolated rather than parameterised: Postgres cannot
    // parameterise a column name. Safe because it is read from the frozen
    // CALENDAR_DAY_COLUMNS by a 0-6 index getDay() is guaranteed to return —
    // no caller input reaches the SQL text. Keep it that way.
    const dayColumn = CALENDAR_DAY_COLUMNS[departureTime.getDay()];
    const departureDate = toIsoDate(departureTime);

    const rows: CandidateRow[] = await this.dataSource.query(
      `
      SELECT * FROM (
      SELECT DISTINCT ON (t.id)
             r."routeType" AS "routeType",
             r."routeId" AS "routeId",
             r."routeShortName" AS "routeShortName",
             t."tripId" AS "tripId",
             t."tripHeadsign" AS "tripHeadsign",
             stop_from."stopId" AS "fromStopId",
             stop_to."stopId" AS "toStopId",
             st_from."departureTime" AS "departureTime",
             st_to."arrivalTime" AS "arrivalTime",
             stop_from."stopName" AS "fromStopName",
             ST_X(stop_from.location::geometry) AS "fromLon",
             ST_Y(stop_from.location::geometry) AS "fromLat",
             stop_to."stopName" AS "toStopName",
             ST_X(stop_to.location::geometry) AS "toLon",
             ST_Y(stop_to.location::geometry) AS "toLat",
             st_from."stopSequence" AS "fromSequence",
             st_to."stopSequence" AS "toSequence"
      FROM gtfs_stop_time st_from
      JOIN gtfs_stop stop_from ON stop_from.id = st_from."stopDbId"
      JOIN gtfs_stop_time st_to
        ON st_to."tripDbId" = st_from."tripDbId"
       AND st_to."stopSequence" > st_from."stopSequence"
      JOIN gtfs_stop stop_to ON stop_to.id = st_to."stopDbId"
      JOIN gtfs_trip t ON t.id = st_from."tripDbId"
      JOIN gtfs_route r ON r.id = t."routeDbId"
      JOIN gtfs_calendar c ON c.id = t."calendarDbId"
      WHERE c."${dayColumn}" = true
        AND $7::date BETWEEN c."startDate" AND c."endDate"
        AND ST_DWithin(
              stop_from.location::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
              $5
            )
        AND ST_DWithin(
              stop_to.location::geography,
              ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
              $5
            )
        AND st_from."departureTime" >= $6
      -- DISTINCT ON keeps one row per trip: without it a single trip yields
      -- every (boarding, alighting) pair it contains, and LIMIT would return
      -- three slices of the same departure instead of three departures. The
      -- leading ORDER BY key must match DISTINCT ON; the rest picks which pair
      -- survives — earliest boarding, then the furthest ride from it.
      ORDER BY t.id,
               st_from."departureTime" ASC,
               st_to."arrivalTime" DESC
      ) candidates
      -- Soonest first. In a dense network these alternatives differ mainly by
      -- boarding stop, not departure time: several stops fall inside the radius,
      -- so the rider chooses between a closer stop and a faster ride.
      ORDER BY candidates."departureTime" ASC
      LIMIT $8
      `,
      [
        from.lon,
        from.lat,
        to.lon,
        to.lat,
        NEARBY_STOP_RADIUS_METERS,
        departureTimeOfDay,
        departureDate,
        MAX_DEPARTURES,
      ],
    );

    const geometries = await this.rideGeometries(rows);

    // Only a fresh GTFS-RT snapshot may shift a schedule; a stale one is
    // served as pure theory (see GtfsRtService.isFresh). Freshness is measured
    // against the wall clock, deliberately NOT against departureTime — the
    // latter is the itinerary's date, which a user can set weeks ahead, and
    // comparing a snapshot's age to it would read as "fresh" for any future
    // search.
    const delays = this.gtfsRtService.isFresh()
      ? this.gtfsRtService.getSnapshot()!.delays
      : null;

    return rows.map((row) => {
      const from = {
        name: row.fromStopName,
        lat: row.fromLat,
        lon: row.fromLon,
      };
      const to = { name: row.toStopName, lat: row.toLat, lon: row.toLon };
      const departureDelay =
        delays?.get(tripStopKey(row.tripId, row.fromStopId))?.delaySeconds ??
        null;
      const arrivalDelay =
        delays?.get(tripStopKey(row.tripId, row.toStopId))?.delaySeconds ??
        // A trip delayed at boarding but with no update at the alighting stop
        // is still late on arrival — carry the departure delay forward rather
        // than inventing a miraculous catch-up.
        departureDelay;
      const realtime = departureDelay !== null || arrivalDelay !== null;
      return {
        mode: routeTypeToMode(row.routeType),
        durationSeconds:
          gtfsTimeToSeconds(row.arrivalTime) +
          (arrivalDelay ?? 0) -
          (gtfsTimeToSeconds(row.departureTime) + (departureDelay ?? 0)),
        // Straight-line between the matched stops, not the line's real
        // alignment: GTFS carries no per-segment distance and ORS has no
        // "follow this transit line" profile.
        distanceMeters: haversineDistanceMeters(from, to),
        from,
        to,
        routeShortName: row.routeShortName,
        tripHeadsign: row.tripHeadsign,
        routeId: row.routeId,
        realtime,
        // The delay a rider actually experiences: how much later they board.
        delaySeconds: departureDelay ?? 0,
        // The stops this ride actually serves between boarding and alighting.
        // Not the rail/road alignment — TaM's GTFS ships no shapes.txt — but a
        // line through the served stops follows the route far more closely
        // than a single chord, and needs no extra data source.
        geometry: geometries.get(row.tripId),
        // The real boarding time of THIS departure, so several alternatives on
        // one line stay distinguishable. Built on departureTime's own calendar
        // day, matching the day the calendar filter selected above.
        scheduledDeparture: atTimeOfDay(
          departureTime,
          gtfsTimeToSeconds(row.departureTime) + (departureDelay ?? 0),
        ),
      };
    });
  }

  // One query for every candidate ride, keyed by trip: N candidates would
  // otherwise mean N round trips. Returns the ordered stop list of each ride,
  // boarding and alighting included, so the caller can use it as a polyline.
  private async rideGeometries(
    rows: CandidateRow[],
  ): Promise<Map<string, { name: string; lat: number; lon: number }[]>> {
    const geometries = new Map<
      string,
      { name: string; lat: number; lon: number }[]
    >();
    if (rows.length === 0) return geometries;

    // A ride of two consecutive stops has nothing between them, so its chord
    // is already the whole line — no need to ask the database.
    const rides = rows.filter((row) => row.toSequence - row.fromSequence > 1);
    if (rides.length === 0) return geometries;

    const stops: RideStopRow[] = await this.dataSource.query(
      `
      SELECT t."tripId" AS "tripId",
             st."stopSequence" AS "stopSequence",
             s."stopName" AS "name",
             ST_X(s.location::geometry) AS "lon",
             ST_Y(s.location::geometry) AS "lat"
      FROM unnest($1::text[], $2::int[], $3::int[]) AS ride("tripId", lo, hi)
      JOIN gtfs_trip t ON t."tripId" = ride."tripId"
      JOIN gtfs_stop_time st ON st."tripDbId" = t.id
       AND st."stopSequence" BETWEEN ride.lo AND ride.hi
      JOIN gtfs_stop s ON s.id = st."stopDbId"
      ORDER BY t."tripId", st."stopSequence"
      `,
      [
        rides.map((row) => row.tripId),
        rides.map((row) => row.fromSequence),
        rides.map((row) => row.toSequence),
      ],
    );

    // Rows arrive ordered by (tripId, stopSequence), so appending preserves
    // travel order.
    for (const stop of stops) {
      const path = geometries.get(stop.tripId) ?? [];
      path.push({ name: stop.name, lat: stop.lat, lon: stop.lon });
      geometries.set(stop.tripId, path);
    }
    return geometries;
  }
}

// KNOWN GAP: getHours() yields 0-23, so this never matches a stop_time past
// midnight (GTFS's >24:00:00 convention, e.g. "25:15:00"). TaM's urban network
// has no meaningful overnight service; revisit if a night feed is added.
function toGtfsTimeOfDay(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// Local-time getters, deliberately matching toGtfsTimeOfDay above: the date
// and the time-of-day must be read off the same clock, or a late-evening
// search could filter on tomorrow's calendar while comparing today's times.
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Wall-clock instant for a time-of-day on `date`'s own calendar day. Seconds
// past midnight, so GTFS's >24:00:00 overnight convention rolls into the next
// day on its own rather than being clamped.
function atTimeOfDay(date: Date, secondsSinceMidnight: number): Date {
  const midnight = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  return new Date(midnight.getTime() + secondsSinceMidnight * 1000);
}

function gtfsTimeToSeconds(time: string): number {
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

// GTFS route_type 0 = Tram, 3 = Bus, 715 = extended "shuttle bus" code,
// already folded into Bus by the import pipeline (see CONTEXT.md).
function routeTypeToMode(routeType: number): TransportMode {
  return routeType === 0 ? TransportMode.Tram : TransportMode.Bus;
}
