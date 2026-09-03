import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { DataSource, EntityManager, ObjectLiteral } from 'typeorm';
import type { UpsertOptions } from 'typeorm/repository/UpsertOptions';
import { GtfsAgency } from './entities/gtfs-agency.entity';
import { GtfsRoute } from './entities/gtfs-route.entity';
import { GtfsCalendar } from './entities/gtfs-calendar.entity';
import { GtfsStop } from './entities/gtfs-stop.entity';
import { GtfsTrip } from './entities/gtfs-trip.entity';
import { GtfsStopTime } from './entities/gtfs-stop-time.entity';

interface AgencyRow {
  agency_id: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_lang?: string;
  agency_phone?: string;
}

interface RouteRow {
  route_id: string;
  agency_id: string;
  route_short_name?: string;
  route_long_name?: string;
  route_type: string;
  route_color?: string;
  route_text_color?: string;
}

interface CalendarRow {
  service_id: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  start_date: string;
  end_date: string;
}

interface StopRow {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
  parent_station?: string;
}

interface TripRow {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign?: string;
}

interface StopTimeRow {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
}

function parseCsv<T>(zip: AdmZip, fileName: string): T[] {
  const entry = zip.getEntry(fileName);
  if (!entry) {
    throw new Error(`GTFS zip is missing ${fileName}`);
  }
  try {
    return parse(entry.getData(), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw new Error(`Failed to parse ${fileName}: ${(err as Error).message}`);
  }
}

function toGtfsDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

// ponytail: PostgreSQL caps bind params at 65535 per query; GTFS files (esp.
// stop_times) can have tens of thousands of rows, so upserts are chunked.
const UPSERT_CHUNK_SIZE = 2000;

async function chunkedUpsert<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: new () => T,
  rows: T[],
  conflictPaths: string[] | UpsertOptions<T>,
): Promise<void> {
  const repository = manager.getRepository(entity);
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    await repository.upsert(
      rows.slice(i, i + UPSERT_CHUNK_SIZE),
      conflictPaths,
    );
  }
}

@Injectable()
export class GtfsImportService {
  private readonly logger = new Logger(GtfsImportService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // TaM republishes its static GTFS a few times a year (new lines, schedule
  // changes) — this was previously a manual `npm run import:gtfs` that never
  // got run against production, so tram/bus data went stale silently.
  // ponytail: weekly is arbitrary slack, not a TaM-documented cadence; move
  // to a webhook/version check if a same-day publish turnaround matters.
  @Cron(CronExpression.EVERY_WEEK)
  async scheduledImport(): Promise<void> {
    try {
      const url = this.config.getOrThrow<string>('GTFS_STATIC_URL');
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`GTFS static download failed: HTTP ${response.status}`);
      }
      await this.importFromZip(Buffer.from(await response.arrayBuffer()));
      this.logger.log('Scheduled GTFS import completed successfully.');
    } catch (err) {
      this.logger.error('Scheduled GTFS import failed', err);
    }
  }

  async importFromZip(zipBuffer: Buffer): Promise<void> {
    const zip = new AdmZip(zipBuffer);

    await this.dataSource.transaction(async (manager) => {
      const agencyById = await this.importAgencies(manager, zip);
      await this.importRoutes(manager, zip, agencyById);
      const calendarById = await this.importCalendars(manager, zip);
      const stopById = await this.importStops(manager, zip);
      const tripById = await this.importTrips(manager, zip, calendarById);
      await this.importStopTimes(manager, zip, tripById, stopById);
    });
  }

  private async importAgencies(
    manager: EntityManager,
    zip: AdmZip,
  ): Promise<Map<string, GtfsAgency>> {
    const rows = parseCsv<AgencyRow>(zip, 'agency.txt');
    await chunkedUpsert(
      manager,
      GtfsAgency,
      rows.map((row) => ({
        agencyId: row.agency_id,
        agencyName: row.agency_name,
        agencyUrl: row.agency_url,
        agencyTimezone: row.agency_timezone,
        agencyLang: row.agency_lang || null,
        agencyPhone: row.agency_phone || null,
      })),
      ['agencyId'],
    );
    const agencies = await manager.getRepository(GtfsAgency).find();
    return new Map(agencies.map((a) => [a.agencyId, a]));
  }

  private async importRoutes(
    manager: EntityManager,
    zip: AdmZip,
    agencyById: Map<string, GtfsAgency>,
  ): Promise<void> {
    const rows = parseCsv<RouteRow>(zip, 'routes.txt');
    await chunkedUpsert(
      manager,
      GtfsRoute,
      rows.map((row) => {
        const agency = agencyById.get(row.agency_id);
        if (!agency) {
          throw new Error(
            `routes.txt references unknown agency_id "${row.agency_id}"`,
          );
        }
        return {
          routeId: row.route_id,
          agencyDbId: agency.id,
          routeShortName: row.route_short_name || null,
          routeLongName: row.route_long_name || null,
          routeType: parseInt(row.route_type, 10),
          routeColor: row.route_color || null,
          routeTextColor: row.route_text_color || null,
        };
      }),
      ['routeId'],
    );
  }

  private async importCalendars(
    manager: EntityManager,
    zip: AdmZip,
  ): Promise<Map<string, GtfsCalendar>> {
    const rows = parseCsv<CalendarRow>(zip, 'calendar.txt');
    await chunkedUpsert(
      manager,
      GtfsCalendar,
      rows.map((row) => ({
        serviceId: row.service_id,
        monday: row.monday === '1',
        tuesday: row.tuesday === '1',
        wednesday: row.wednesday === '1',
        thursday: row.thursday === '1',
        friday: row.friday === '1',
        saturday: row.saturday === '1',
        sunday: row.sunday === '1',
        startDate: toGtfsDate(row.start_date),
        endDate: toGtfsDate(row.end_date),
      })),
      ['serviceId'],
    );
    const calendars = await manager.getRepository(GtfsCalendar).find();
    return new Map(calendars.map((c) => [c.serviceId, c]));
  }

  private async importStops(
    manager: EntityManager,
    zip: AdmZip,
  ): Promise<Map<string, GtfsStop>> {
    const rows = parseCsv<StopRow>(zip, 'stops.txt');
    await chunkedUpsert(
      manager,
      GtfsStop,
      rows.map((row) => ({
        stopId: row.stop_id,
        stopCode: row.stop_code || null,
        stopName: row.stop_name,
        location: {
          type: 'Point' as const,
          coordinates: [parseFloat(row.stop_lon), parseFloat(row.stop_lat)],
        },
        parentStation: row.parent_station || null,
      })),
      ['stopId'],
    );
    const stops = await manager.getRepository(GtfsStop).find();
    return new Map(stops.map((s) => [s.stopId, s]));
  }

  private async importTrips(
    manager: EntityManager,
    zip: AdmZip,
    calendarById: Map<string, GtfsCalendar>,
  ): Promise<Map<string, GtfsTrip>> {
    const rows = parseCsv<TripRow>(zip, 'trips.txt');
    const routes = await manager.getRepository(GtfsRoute).find();
    const routeById = new Map(routes.map((r) => [r.routeId, r]));

    await chunkedUpsert(
      manager,
      GtfsTrip,
      rows.map((row) => {
        const route = routeById.get(row.route_id);
        if (!route) {
          throw new Error(
            `trips.txt references unknown route_id "${row.route_id}"`,
          );
        }
        const calendar = calendarById.get(row.service_id);
        if (!calendar) {
          throw new Error(
            `trips.txt references unknown service_id "${row.service_id}"`,
          );
        }
        return {
          tripId: row.trip_id,
          routeDbId: route.id,
          calendarDbId: calendar.id,
          tripHeadsign: row.trip_headsign || null,
        };
      }),
      ['tripId'],
    );
    const trips = await manager.getRepository(GtfsTrip).find();
    return new Map(trips.map((t) => [t.tripId, t]));
  }

  private async importStopTimes(
    manager: EntityManager,
    zip: AdmZip,
    tripById: Map<string, GtfsTrip>,
    stopById: Map<string, GtfsStop>,
  ): Promise<void> {
    const rows = parseCsv<StopTimeRow>(zip, 'stop_times.txt');
    await chunkedUpsert(
      manager,
      GtfsStopTime,
      rows.map((row) => {
        const trip = tripById.get(row.trip_id);
        if (!trip) {
          throw new Error(
            `stop_times.txt references unknown trip_id "${row.trip_id}"`,
          );
        }
        const stop = stopById.get(row.stop_id);
        if (!stop) {
          throw new Error(
            `stop_times.txt references unknown stop_id "${row.stop_id}"`,
          );
        }
        return {
          tripDbId: trip.id,
          stopDbId: stop.id,
          arrivalTime: row.arrival_time,
          departureTime: row.departure_time,
          stopSequence: parseInt(row.stop_sequence, 10),
        };
      }),
      ['tripDbId', 'stopDbId', 'stopSequence'],
    );
  }
}
