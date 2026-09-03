import { Injectable } from '@nestjs/common';
import { TransportMode } from '../common/transport-mode.enum';
import { OpenRouteService } from '../integration/openrouteservice.service';
import { GeoPoint } from './geo-point';
import { haversineDistanceMeters } from './geo-distance';
import { RawJourneySegment, toWaypoint } from './journey-segment';
import { MobilityProvider } from './mobility-provider';

// ~5 km/h, the standard pedestrian planning constant. Only used when
// OpenRouteService is unavailable.
const WALK_SPEED_METERS_PER_SECOND = 5000 / 3600;

@Injectable()
export class WalkMobilityProvider implements MobilityProvider {
  readonly modes = [TransportMode.Marche] as const;

  constructor(private readonly openRouteService: OpenRouteService) {}

  // The direct walk, computed alongside Bus/Tram and Vélo rather than as a
  // last-resort fallback, so the UI can offer a real "walk only" option with
  // its own duration even when a faster multimodal Journey exists.
  //
  // Needs no bridging: it already runs origin to destination. The planner
  // recognises that on its own — a walk candidate's ends ARE the search
  // points, so its bridging check finds nothing to add.
  async proposeJourneys(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
    wanted: (mode: TransportMode) => boolean,
  ): Promise<RawJourneySegment[][]> {
    if (!wanted(TransportMode.Marche)) return [];
    const segments = await this.getSegments(from, to, departureTime);
    return segments.length > 0 ? [segments] : [];
  }

  // departureTime is unused: it belongs to the shared MobilityProvider
  // contract for Bus/Tram, and walking has no schedule to filter against.
  async getSegments(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<RawJourneySegment[]> {
    void departureTime;
    const route = await this.openRouteService.getRoute(
      from,
      to,
      'foot-walking',
    );
    const distanceMeters = route
      ? route.distanceMeters
      : haversineDistanceMeters(from, to);
    const durationSeconds = route
      ? Math.round(route.durationSeconds)
      : Math.round(distanceMeters / WALK_SPEED_METERS_PER_SECOND);

    return [
      {
        mode: TransportMode.Marche,
        durationSeconds,
        distanceMeters,
        from: toWaypoint(from, ''),
        to: toWaypoint(to, ''),
        steps: route?.steps,
        geometry: route?.geometry?.map((p) => toWaypoint(p, '')),
      },
    ];
  }
}
