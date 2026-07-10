import { Injectable } from '@nestjs/common';
import { TransportMode } from '../common/transport-mode.enum';
import { GbfsService } from '../integration/gbfs.service';
import { GbfsSnapshot, GbfsStation } from '../integration/gbfs.types';
import { GeoPoint } from './geo-point';
import { haversineDistanceMeters } from './geo-distance';
import { RawJourneySegment, toWaypoint } from './journey-segment';
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
  ): Promise<RawJourneySegment[]> {
    void departureTime;
    const snapshot = this.gbfsService.getSnapshot();
    if (!snapshot) {
      return Promise.resolve([]);
    }

    // GBFS is dock-based, not free-floating: a Vélo segment needs a real
    // pickup station (bikes available) AND a real drop-off station (a free
    // dock), not just the raw search coordinates at either end.
    const pickupStation = this.findNearestStation(
      from,
      snapshot,
      (status) => status.isRenting && status.bikesAvailable > 0,
    );
    if (!pickupStation) {
      return Promise.resolve([]);
    }

    const dropoffStation = this.findNearestStation(
      to,
      snapshot,
      (status) => status.docksAvailable > 0,
    );
    if (!dropoffStation) {
      return Promise.resolve([]);
    }

    const distanceMeters = haversineDistanceMeters(
      pickupStation,
      dropoffStation,
    );
    const durationSeconds = Math.round(
      distanceMeters / BIKE_SPEED_METERS_PER_SECOND,
    );

    return Promise.resolve([
      {
        mode: TransportMode.Velo,
        durationSeconds,
        from: toWaypoint(pickupStation, pickupStation.name),
        to: toWaypoint(dropoffStation, dropoffStation.name),
      },
    ]);
  }

  private findNearestStation(
    point: GeoPoint,
    snapshot: GbfsSnapshot,
    matches: (status: {
      isRenting: boolean;
      bikesAvailable: number;
      docksAvailable: number;
    }) => boolean,
  ): GbfsStation | null {
    const candidates = snapshot.stations
      .filter((station) => {
        const status = snapshot.statusByStationId.get(station.stationId);
        return status && matches(status);
      })
      .map((station) => ({
        station,
        distance: haversineDistanceMeters(point, station),
      }))
      .filter(({ distance }) => distance <= NEARBY_STATION_RADIUS_METERS)
      .sort((a, b) => a.distance - b.distance);

    return candidates[0]?.station ?? null;
  }
}
