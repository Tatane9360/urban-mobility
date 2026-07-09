import { Injectable } from '@nestjs/common';
import { TransportMode } from '../common/transport-mode.enum';
import { GeoPoint } from './geo-point';
import { haversineDistanceMeters } from './geo-distance';
import { JourneySegment, toWaypoint } from './journey-segment';
import { MobilityProvider } from './mobility-provider';

// ponytail: average walking speed, ~5 km/h — standard pedestrian planning
// constant, not sourced from a live routing API in this ticket (see #11).
const WALK_SPEED_METERS_PER_SECOND = 5000 / 3600;

@Injectable()
export class WalkMobilityProvider implements MobilityProvider {
  // ponytail: departureTime is part of the shared MobilityProvider contract
  // (Bus/Tram needs it) but walking has no schedule to filter against.
  getSegments(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<JourneySegment[]> {
    void departureTime;
    const distanceMeters = haversineDistanceMeters(from, to);
    const durationSeconds = Math.round(
      distanceMeters / WALK_SPEED_METERS_PER_SECOND,
    );

    return Promise.resolve([
      {
        mode: TransportMode.Marche,
        durationSeconds,
        from: toWaypoint(from, ''),
        to: toWaypoint(to, ''),
      },
    ]);
  }
}
