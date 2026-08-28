import { BadRequestException, Injectable } from '@nestjs/common';
import { CarbonService } from '../carbon/carbon.service';
import { GeocodingService } from '../integration/geocoding.service';
import { GtfsRtService } from '../integration/gtfs-rt.service';
import { ServiceAlert } from '../integration/gtfs-rt.types';
import { BikeMobilityProvider } from './bike.mobility-provider';
import { BusTramMobilityProvider } from './bus-tram.mobility-provider';
import { GeoPoint } from './geo-point';
import { haversineDistanceMeters } from './geo-distance';
import { Journey } from './journey';
import { RawJourneySegment } from './journey-segment';
import { PlanJourneyDto, JourneySortCriterion } from './dto/plan-journey.dto';
import { WalkMobilityProvider } from './walk.mobility-provider';

// ponytail: below this, two points are "the same place" for bridging-walk
// purposes — avoids a zero-duration Marche segment when a stop/station sits
// right on the search point.
const NEGLIGIBLE_WALK_METERS = 10;

@Injectable()
export class JourneyPlannerService {
  constructor(
    private readonly geocodingService: GeocodingService,
    private readonly gtfsRtService: GtfsRtService,
    private readonly carbonService: CarbonService,
    private readonly busTramProvider: BusTramMobilityProvider,
    private readonly bikeProvider: BikeMobilityProvider,
    private readonly walkProvider: WalkMobilityProvider,
  ) {}

  async plan(dto: PlanJourneyDto, departureTime: Date): Promise<Journey[]> {
    const [origin, destination] = await Promise.all([
      this.resolvePoint(dto.origin),
      this.resolvePoint(dto.destination),
    ]);

    // degraded = the planner could not use real time. Absent snapshot OR one
    // too old to be trusted (PRD KPI 3: <=30s freshness) — a 10-minute-old
    // snapshot served as live is the bug this replaces. Both take the wall
    // clock, not departureTime: how stale the feed is has nothing to do with
    // which day the user asked about.
    const degraded = !this.gtfsRtService.isFresh();
    const alerts = this.gtfsRtService.getActiveAlerts();

    // A direct Marche candidate is computed alongside Bus/Tram and Vélo,
    // always — not just as a last-resort fallback — so the UI can offer a
    // real "walk only" option (with its own duration) even when a faster
    // multimodal Journey exists, per the mode-icon picker (like Google Maps'
    // per-mode duration row).
    const [transitSegments, bikeSegments, walkSegments] = await Promise.all([
      this.busTramProvider.getSegments(origin, destination, departureTime),
      this.bikeProvider.getSegments(origin, destination, departureTime),
      this.walkProvider.getSegments(origin, destination, departureTime),
    ]);

    const journeys: Journey[] = [];
    for (const segments of [
      withAlerts(transitSegments, alerts),
      bikeSegments,
    ]) {
      if (segments.length === 0) continue;
      const bridged = await this.withBridgingWalks(
        origin,
        destination,
        segments,
        departureTime,
      );
      journeys.push(this.toJourney(bridged, degraded, departureTime));
    }
    journeys.push(this.toJourney(walkSegments, degraded, departureTime));

    return sortJourneys(journeys, dto.sort);
  }

  private async resolvePoint(point: {
    coordinates?: GeoPoint;
    address?: string;
  }): Promise<GeoPoint> {
    if (point.coordinates) {
      return point.coordinates;
    }
    if (!point.address) {
      throw new BadRequestException(
        'Each journey point needs either coordinates or an address',
      );
    }

    const results = await this.geocodingService.geocode(point.address);
    if (results.length === 0) {
      throw new BadRequestException(
        `No location found for address "${point.address}"`,
      );
    }
    return results[0];
  }

  // Bus/Tram and Vélo segments only cover stop-to-stop / station-to-station —
  // this adds the Marche segment on either side to reach the actual search
  // point, exactly like a real trip planner (Google Maps, etc.).
  private async withBridgingWalks(
    origin: GeoPoint,
    destination: GeoPoint,
    segments: RawJourneySegment[],
    departureTime: Date,
  ): Promise<RawJourneySegment[]> {
    const first = segments[0];
    const last = segments[segments.length - 1];
    const result = [...segments];

    if (haversineDistanceMeters(origin, first.from) > NEGLIGIBLE_WALK_METERS) {
      const approach = await this.walkProvider.getSegments(
        origin,
        first.from,
        departureTime,
      );
      result.unshift(...approach);
    }

    if (
      haversineDistanceMeters(destination, last.to) > NEGLIGIBLE_WALK_METERS
    ) {
      const exit = await this.walkProvider.getSegments(
        last.to,
        destination,
        departureTime,
      );
      result.push(...exit);
    }

    return result;
  }

  private toJourney(
    rawSegments: RawJourneySegment[],
    degraded: boolean,
    departureTime: Date,
  ): Journey {
    let cursor = departureTime;
    const segments = rawSegments.map((s) => {
      const startTime = cursor;
      const endTime = new Date(cursor.getTime() + s.durationSeconds * 1000);
      cursor = endTime;
      return {
        ...this.carbonService.withCarbon(s),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };
    });
    const carbonGrams = this.carbonService.journeyCarbonGrams(segments);

    return {
      segments,
      durationSeconds: segments.reduce((sum, s) => sum + s.durationSeconds, 0),
      carbonGrams,
      carComparison: this.carbonService.carComparison(segments, carbonGrams),
      degraded,
    };
  }
}

// A segment carries the alerts that name its own GTFS route_id. Segments
// with no routeId (Marche/Vélo) never match.
// ponytail: routeId matching only — GTFS-RT informedEntity can also select by
// stop or trip, and those selectors are dropped at decode time (see
// gtfs-rt.types.ts). Widen both together if TaM starts publishing them.
function withAlerts(
  segments: RawJourneySegment[],
  alerts: ServiceAlert[],
): RawJourneySegment[] {
  if (alerts.length === 0) return segments;
  return segments.map((segment) => {
    const matching = segment.routeId
      ? alerts.filter((a) => a.routeIds.includes(segment.routeId!))
      : [];
    return matching.length > 0 ? { ...segment, alerts: matching } : segment;
  });
}

function sortJourneys(
  journeys: Journey[],
  criterion: JourneySortCriterion | undefined,
): Journey[] {
  if (criterion === 'carbon') {
    return [...journeys].sort((a, b) => a.carbonGrams - b.carbonGrams);
  }
  return [...journeys].sort((a, b) => a.durationSeconds - b.durationSeconds);
}
