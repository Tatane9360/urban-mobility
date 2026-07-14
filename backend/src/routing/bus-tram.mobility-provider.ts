import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TransportMode } from '../common/transport-mode.enum';
import { GeoPoint } from './geo-point';
import { haversineDistanceMeters } from './geo-distance';
import { RawJourneySegment } from './journey-segment';
import { MobilityProvider } from './mobility-provider';

// ponytail: search radius for "stop near a point" — GTFS stop spacing in
// urban Montpellier is a few hundred meters, 500m matches the radius already
// used by the integration e2e test's spatial query.
const NEARBY_STOP_RADIUS_METERS = 500;

interface CandidateRow {
  routeType: number;
  routeShortName: string | null;
  tripHeadsign: string | null;
  departureTime: string;
  arrivalTime: string;
  fromStopName: string;
  fromLon: number;
  fromLat: number;
  toStopName: string;
  toLon: number;
  toLat: number;
}

@Injectable()
export class BusTramMobilityProvider implements MobilityProvider {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // ponytail: raw SQL, not the TypeORM query builder — same call made by
  // gtfs-import.e2e-spec.ts's own spatial query, since QueryBuilder can't
  // express PostGIS functions (ST_DWithin) cleanly. All caller-supplied
  // values are passed as positional params, never interpolated into the SQL.
  async getSegments(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<RawJourneySegment[]> {
    const departureTimeOfDay = toGtfsTimeOfDay(departureTime);

    const rows: CandidateRow[] = await this.dataSource.query(
      `
      SELECT r."routeType" AS "routeType",
             r."routeShortName" AS "routeShortName",
             t."tripHeadsign" AS "tripHeadsign",
             st_from."departureTime" AS "departureTime",
             st_to."arrivalTime" AS "arrivalTime",
             stop_from."stopName" AS "fromStopName",
             ST_X(stop_from.location::geometry) AS "fromLon",
             ST_Y(stop_from.location::geometry) AS "fromLat",
             stop_to."stopName" AS "toStopName",
             ST_X(stop_to.location::geometry) AS "toLon",
             ST_Y(stop_to.location::geometry) AS "toLat"
      FROM gtfs_stop_time st_from
      JOIN gtfs_stop stop_from ON stop_from.id = st_from."stopDbId"
      JOIN gtfs_stop_time st_to
        ON st_to."tripDbId" = st_from."tripDbId"
       AND st_to."stopSequence" > st_from."stopSequence"
      JOIN gtfs_stop stop_to ON stop_to.id = st_to."stopDbId"
      JOIN gtfs_trip t ON t.id = st_from."tripDbId"
      JOIN gtfs_route r ON r.id = t."routeDbId"
      WHERE ST_DWithin(
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
      ORDER BY st_from."departureTime" ASC
      LIMIT 1
      `,
      [
        from.lon,
        from.lat,
        to.lon,
        to.lat,
        NEARBY_STOP_RADIUS_METERS,
        departureTimeOfDay,
      ],
    );

    return rows.map((row) => {
      const from = { name: row.fromStopName, lat: row.fromLat, lon: row.fromLon };
      const to = { name: row.toStopName, lat: row.toLat, lon: row.toLon };
      return {
        mode: routeTypeToMode(row.routeType),
        durationSeconds:
          gtfsTimeToSeconds(row.arrivalTime) -
          gtfsTimeToSeconds(row.departureTime),
        // ponytail: Haversine between the matched stops, not the actual rail/
        // road alignment of the line — GTFS doesn't carry a per-segment
        // distance and OpenRouteService has no "follow this transit line"
        // profile, so straight-line is the honest available approximation
        // here (see #16).
        distanceMeters: haversineDistanceMeters(from, to),
        from,
        to,
        routeShortName: row.routeShortName,
        tripHeadsign: row.tripHeadsign,
      };
    });
  }
}

// ponytail: date.getHours() only ever yields 0-23, so this can't match a
// stop_time stored past midnight (GTFS's own >24:00:00 convention for
// overnight trips, e.g. "25:15:00"). Known gap, not handled — TaM's urban
// bus/tram network has no meaningful overnight service, so the impact is
// negligible for this MVP; revisit if a night-service GTFS feed is added.
function toGtfsTimeOfDay(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
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
