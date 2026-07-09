import { Injectable } from '@nestjs/common';
import { TransportMode } from '../common/transport-mode.enum';
import { GbfsService } from '../integration/gbfs.service';
import { GbfsSnapshot, GbfsStation } from '../integration/gbfs.types';
import { GeoPoint } from './geo-point';
import { haversineDistanceMeters } from './geo-distance';
import { JourneySegment } from './journey-segment';
import { MobilityProvider } from './mobility-provider';

// ponytail: average cycling speed in urban traffic, ~15 km/h — standard
// bike planning constant, not sourced from a live routing API (see #11).
const BIKE_SPEED_METERS_PER_SECOND = 15000 / 3600;

// ponytail: same "nearby stop" radius used for Bus/Tram stops — GBFS
// stations are similarly spaced in urban Montpellier.
const NEARBY_STATION_RADIUS_METERS = 500;

@Injectable()
export class BikeMobilityProvider implements MobilityProvider {
  constructor(private readonly gbfsService: GbfsService) {}

  // ponytail: departureTime is part of the shared MobilityProvider contract
  // (Bus/Tram needs it) but bike availability is read from the live GBFS
  // snapshot, not a schedule.
  getSegments(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<JourneySegment[]> {
    void departureTime;
    const snapshot = this.gbfsService.getSnapshot();
    if (!snapshot) {
      return Promise.resolve([]);
    }

    const availableStation = this.findNearestStationWithBikes(from, snapshot);
    if (!availableStation) {
      return Promise.resolve([]);
    }

    const distanceMeters = haversineDistanceMeters(from, to);
    const durationSeconds = Math.round(
      distanceMeters / BIKE_SPEED_METERS_PER_SECOND,
    );

    return Promise.resolve([
      {
        mode: TransportMode.Velo,
        durationSeconds,
        from: { name: availableStation.name, ...from },
        to: { name: '', ...to },
      },
    ]);
  }

  private findNearestStationWithBikes(
    from: GeoPoint,
    snapshot: GbfsSnapshot,
  ): GbfsStation | null {
    const stationsWithBikes = snapshot.stations
      .filter((station) => {
        const status = snapshot.statusByStationId.get(station.stationId);
        return status && status.isRenting && status.bikesAvailable > 0;
      })
      .map((station) => ({
        station,
        distance: haversineDistanceMeters(from, station),
      }))
      .filter(({ distance }) => distance <= NEARBY_STATION_RADIUS_METERS)
      .sort((a, b) => a.distance - b.distance);

    return stationsWithBikes[0]?.station ?? null;
  }
}
