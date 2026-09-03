import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GeoPoint } from '../routing/geo-point';
import { Ride, RideStop } from './ride';

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

// The GTFS referential: everything that knows how the static feed is stored
// and queried. Hands back Rides — a domain concept (see CONTEXT.md) — so the
// raw GTFS vocabulary (route_type, calendar columns, stop_sequence,
// "25:15:00" time-of-day strings) stops at this seam and never reaches
// `routing`.
@Injectable()
export class GtfsScheduleRepository {
  // Raw SQL because QueryBuilder cannot express PostGIS functions (ST_DWithin)
  // cleanly. Every caller-supplied value is a positional param, never
  // interpolated into the SQL text.
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // The next few rides departing from near `from` and alighting near `to`,
  // earliest first, on the service running that day. Theoretical schedule
  // only — GTFS-RT delays are applied by the caller.
  async findRides(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<Ride[]> {
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

    return rows.map((row) => ({
      tripId: row.tripId,
      routeId: row.routeId,
      routeShortName: row.routeShortName,
      tripHeadsign: row.tripHeadsign,
      isTram: row.routeType === 0,
      boarding: {
        stopId: row.fromStopId,
        name: row.fromStopName,
        lat: row.fromLat,
        lon: row.fromLon,
      },
      alighting: {
        stopId: row.toStopId,
        name: row.toStopName,
        lat: row.toLat,
        lon: row.toLon,
      },
      // Seconds past midnight on `departureTime`'s own calendar day, the one
      // the calendar filter selected. GTFS's >24:00:00 overnight convention
      // survives as a value past 86400 rather than being clamped.
      scheduledDepartureSeconds: gtfsTimeToSeconds(row.departureTime),
      scheduledArrivalSeconds: gtfsTimeToSeconds(row.arrivalTime),
      servedStops: geometries.get(row.tripId),
    }));
  }

  // One query for every candidate ride, keyed by trip: N candidates would
  // otherwise mean N round trips. Returns the ordered stop list of each ride,
  // boarding and alighting included, so the caller can use it as a polyline.
  private async rideGeometries(
    rows: CandidateRow[],
  ): Promise<Map<string, RideStop[]>> {
    const geometries = new Map<string, RideStop[]>();
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

function gtfsTimeToSeconds(time: string): number {
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}
