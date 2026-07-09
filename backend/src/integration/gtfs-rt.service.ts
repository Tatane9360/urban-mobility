import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { GtfsRtSnapshot, VehiclePosition } from './gtfs-rt.types';

// ponytail: PRD KPI is <=30s staleness for GTFS-RT; poll at half that so the
// cache is never more than ~15s stale.
const POLL_INTERVAL_MS = 15_000;

@Injectable()
export class GtfsRtService implements OnModuleInit {
  private readonly logger = new Logger(GtfsRtService.name);
  private readonly vehiclePositionUrls: string[];
  private snapshot: GtfsRtSnapshot | null = null;

  constructor(config: ConfigService) {
    this.vehiclePositionUrls = [
      config.getOrThrow<string>('GTFS_RT_URBAIN_VEHICLE_POSITION_URL'),
      config.getOrThrow<string>('GTFS_RT_SUBURBAIN_VEHICLE_POSITION_URL'),
    ];
  }

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  @Interval(POLL_INTERVAL_MS)
  async refresh(): Promise<void> {
    try {
      const vehiclesByNetwork = await Promise.all(
        this.vehiclePositionUrls.map((url) => this.fetchVehiclePositions(url)),
      );
      this.snapshot = {
        vehicles: vehiclesByNetwork.flat(),
        fetchedAt: new Date(),
      };
    } catch (err) {
      this.logger.error(
        `GTFS-RT refresh failed, keeping previous snapshot: ${(err as Error).message}`,
      );
    }
  }

  getSnapshot(): GtfsRtSnapshot | null {
    return this.snapshot;
  }

  private async fetchVehiclePositions(url: string): Promise<VehiclePosition[]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`VehiclePosition HTTP ${response.status} (${url})`);
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    const feed =
      GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);

    return feed.entity
      .filter((entity) => entity.vehicle?.position)
      .map((entity) => {
        const vehicle = entity.vehicle!;
        const position = vehicle.position!;
        return {
          vehicleId: vehicle.vehicle?.id ?? entity.id,
          tripId: vehicle.trip?.tripId ?? null,
          routeId: vehicle.trip?.routeId ?? null,
          lat: position.latitude,
          lon: position.longitude,
          bearing: position.bearing ?? null,
          speed: position.speed ?? null,
          timestamp: vehicle.timestamp
            ? new Date(Number(vehicle.timestamp) * 1000)
            : new Date(),
        };
      });
  }
}
