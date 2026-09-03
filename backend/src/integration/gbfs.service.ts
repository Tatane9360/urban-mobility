import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { GbfsSnapshot, GbfsStation, GbfsStationStatus } from './gbfs.types';

interface StationInformationResponse {
  data: {
    stations: Array<{
      station_id: string;
      name: string;
      lat: number;
      lon: number;
    }>;
  };
}

interface StationStatusResponse {
  data: {
    stations: Array<{
      station_id: string;
      num_bikes_available: number;
      num_docks_available: number;
      is_renting: boolean;
    }>;
  };
}

// GBFS ttl is 60s (endpoints.md); polling at half that keeps the cache under
// ~30s stale without hammering the provider.
const POLL_INTERVAL_MS = 30_000;

@Injectable()
export class GbfsService implements OnModuleInit {
  private readonly logger = new Logger(GbfsService.name);
  private readonly stationInformationUrl: string;
  private readonly stationStatusUrl: string;
  private snapshot: GbfsSnapshot | null = null;

  constructor(config: ConfigService) {
    this.stationInformationUrl = config.getOrThrow<string>(
      'GBFS_STATION_INFORMATION_URL',
    );
    this.stationStatusUrl = config.getOrThrow<string>(
      'GBFS_STATION_STATUS_URL',
    );
  }

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  @Interval(POLL_INTERVAL_MS)
  async refresh(): Promise<void> {
    try {
      const [stations, statuses] = await Promise.all([
        this.fetchStationInformation(),
        this.fetchStationStatus(),
      ]);
      this.snapshot = {
        stations,
        statusByStationId: new Map(statuses.map((s) => [s.stationId, s])),
        fetchedAt: new Date(),
      };
    } catch (err) {
      this.logger.error(
        `GBFS refresh failed, keeping previous snapshot: ${(err as Error).message}`,
      );
    }
  }

  getSnapshot(): GbfsSnapshot | null {
    return this.snapshot;
  }

  private async fetchStationInformation(): Promise<GbfsStation[]> {
    const response = await fetch(this.stationInformationUrl);
    if (!response.ok) {
      throw new Error(`station_information HTTP ${response.status}`);
    }
    const body = (await response.json()) as StationInformationResponse;
    return body.data.stations.map((s) => ({
      stationId: s.station_id,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
    }));
  }

  private async fetchStationStatus(): Promise<GbfsStationStatus[]> {
    const response = await fetch(this.stationStatusUrl);
    if (!response.ok) {
      throw new Error(`station_status HTTP ${response.status}`);
    }
    const body = (await response.json()) as StationStatusResponse;
    return body.data.stations.map((s) => ({
      stationId: s.station_id,
      bikesAvailable: s.num_bikes_available,
      docksAvailable: s.num_docks_available,
      isRenting: s.is_renting,
    }));
  }
}
