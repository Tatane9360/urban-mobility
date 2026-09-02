import { Injectable } from '@nestjs/common';
import { TransportMode } from '../common/transport-mode.enum';
import { GbfsService } from '../integration/gbfs.service';
import { GbfsSnapshot, GbfsStation } from '../integration/gbfs.types';
import { OpenRouteService } from '../integration/openrouteservice.service';
import { GeoPoint } from './geo-point';
import { haversineDistanceMeters } from './geo-distance';
import { RawJourneySegment, toWaypoint } from './journey-segment';
import { MobilityProvider } from './mobility-provider';

// ponytail: average cycling speed in urban traffic, ~15 km/h — standard
// bike planning constant, used only when OpenRouteService is unavailable
// (see #11 for the original Haversine-only fallback).
const BIKE_SPEED_METERS_PER_SECOND = 15000 / 3600;

// A rider without a station on their doorstep will still walk to one —
// the planner already bridges that gap with its own Marche segment, so this
// is a walkable radius (~12 min), not a "station right here" one like
// Bus/Tram's 500m stop search.
const NEARBY_STATION_RADIUS_METERS = 1000;

@Injectable()
export class BikeMobilityProvider implements MobilityProvider {
  constructor(
    private readonly gbfsService: GbfsService,
    private readonly openRouteService: OpenRouteService,
  ) {}

  // ponytail: departureTime is part of the shared MobilityProvider contract
  // (Bus/Tram needs it) but bike availability is read from the live GBFS
  // snapshot, not a schedule.
  async getSegments(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<RawJourneySegment[]> {
    void departureTime;
    const snapshot = this.gbfsService.getSnapshot();
    if (!snapshot) {
      return [];
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
      return [];
    }

    const dropoffStation = this.findNearestStation(
      to,
      snapshot,
      (status) => status.docksAvailable > 0,
    );
    if (!dropoffStation) {
      return [];
    }

    const route = await this.openRouteService.getRoute(
      pickupStation,
      dropoffStation,
      'cycling-regular',
    );
    const distanceMeters = route
      ? route.distanceMeters
      : haversineDistanceMeters(pickupStation, dropoffStation);
    const durationSeconds = route
      ? Math.round(route.durationSeconds)
      : Math.round(distanceMeters / BIKE_SPEED_METERS_PER_SECOND);

    return [
      {
        mode: TransportMode.Velo,
        durationSeconds,
        distanceMeters,
        from: toWaypoint(pickupStation, pickupStation.name),
        to: toWaypoint(dropoffStation, dropoffStation.name),
        steps: route?.steps,
        geometry: route?.geometry?.map((p) => toWaypoint(p, '')),
      },
    ];
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
