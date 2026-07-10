import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeoPoint } from '../routing/geo-point';
import { OrsProfile, OrsRoute } from './openrouteservice.types';

const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions';

interface OrsDirectionsResponse {
  routes: Array<{ summary: { distance: number; duration: number } }>;
}

@Injectable()
export class OpenRouteService {
  private readonly logger = new Logger(OpenRouteService.name);
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.getOrThrow<string>('OPENROUTESERVICE_API_KEY');
  }

  // ponytail: returns null (not a thrown error) on any failure — ORS is a
  // "nicer than Haversine" enrichment, not a required dependency. Callers
  // (Walk/BikeMobilityProvider) fall back to the straight-line estimate,
  // per the PRD's own documented risk mitigation ("clé gratuite + fallback").
  async getRoute(
    from: GeoPoint,
    to: GeoPoint,
    profile: OrsProfile,
  ): Promise<OrsRoute | null> {
    try {
      const response = await fetch(`${ORS_DIRECTIONS_URL}/${profile}`, {
        method: 'POST',
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ],
        }),
      });
      if (!response.ok) {
        this.logger.warn(`ORS ${profile} HTTP ${response.status}`);
        return null;
      }

      const body = (await response.json()) as OrsDirectionsResponse;
      const summary = body.routes[0]?.summary;
      if (!summary) {
        return null;
      }
      return {
        distanceMeters: summary.distance,
        durationSeconds: summary.duration,
      };
    } catch (err) {
      this.logger.warn(`ORS ${profile} request failed: ${(err as Error).message}`);
      return null;
    }
  }
}
