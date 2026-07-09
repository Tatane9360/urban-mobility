import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TransportMode } from '../common/transport-mode.enum';
import { GeoPoint } from './geo-point';
import { JourneySegment } from './journey-segment';
import { MobilityProvider } from './mobility-provider';

// ponytail: search radius for "stop near a point" — GTFS stop spacing in
// urban Montpellier is a few hundred meters, 500m matches the radius already
// used by the integration e2e test's spatial query.
const NEARBY_STOP_RADIUS_METERS = 500;

interface CandidateRow {
  routeType: number;
  departureTime: string;
  arrivalTime: string;
}

@Injectable()
export class BusTramMobilityProvider implements MobilityProvider {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getSegments(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<JourneySegment[]> {
    const departureTimeOfDay = toGtfsTimeOfDay(departureTime);

    const rows: CandidateRow[] = await this.dataSource.query(
      `
      SELECT r."routeType" AS "routeType",
             st_from."departureTime" AS "departureTime",
             st_to."arrivalTime" AS "arrivalTime"
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

    return rows.map((row) => ({
      mode: routeTypeToMode(row.routeType),
      durationSeconds:
        gtfsTimeToSeconds(row.arrivalTime) -
        gtfsTimeToSeconds(row.departureTime),
      from,
      to,
    }));
  }
}

// ponytail: GTFS times are HH:MM:SS, hours can exceed 23 for trips past
// midnight — a search departing e.g. 08:00 must still match those.
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
