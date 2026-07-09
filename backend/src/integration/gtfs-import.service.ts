import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { Repository } from 'typeorm';
import { GtfsAgency } from './entities/gtfs-agency.entity';
import { GtfsRoute } from './entities/gtfs-route.entity';

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

function parseCsv<T>(zip: AdmZip, fileName: string): T[] {
  const entry = zip.getEntry(fileName);
  if (!entry) {
    throw new Error(`GTFS zip is missing ${fileName}`);
  }
  return parse(entry.getData(), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

@Injectable()
export class GtfsImportService {
  constructor(
    @InjectRepository(GtfsAgency)
    private readonly agencyRepository: Repository<GtfsAgency>,
    @InjectRepository(GtfsRoute)
    private readonly routeRepository: Repository<GtfsRoute>,
  ) {}

  async importFromZip(zipBuffer: Buffer): Promise<void> {
    const zip = new AdmZip(zipBuffer);

    const agencyRows = parseCsv<AgencyRow>(zip, 'agency.txt');
    await this.agencyRepository.upsert(
      agencyRows.map((row) => ({
        agencyId: row.agency_id,
        agencyName: row.agency_name,
        agencyUrl: row.agency_url,
        agencyTimezone: row.agency_timezone,
        agencyLang: row.agency_lang || null,
        agencyPhone: row.agency_phone || null,
      })),
      ['agencyId'],
    );

    const routeRows = parseCsv<RouteRow>(zip, 'routes.txt');
    const agencies = await this.agencyRepository.find();
    const agencyById = new Map(agencies.map((a) => [a.agencyId, a]));

    await this.routeRepository.upsert(
      routeRows.map((row) => {
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
}
