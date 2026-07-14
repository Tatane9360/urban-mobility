import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeoPoint } from '../routing/geo-point';
import { OrsProfile, OrsRoute } from './openrouteservice.types';

const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions';

// The plain /directions endpoint only returns a summary. /geojson additionally
// returns the route's full coordinate list, which step.way_points indexes
// into — the only way to get a real lat/lon per turn instruction instead of
// just the segment's overall from/to.
interface OrsGeoJsonResponse {
  features: Array<{
    geometry: { coordinates: Array<[number, number]> };
    properties: {
      summary: { distance: number; duration: number };
      segments: Array<{
        steps: Array<{
          instruction: string;
          distance: number;
          duration: number;
          type: number;
          way_points: [number, number];
        }>;
      }>;
    };
  }>;
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
      const response = await fetch(`${ORS_DIRECTIONS_URL}/${profile}/geojson`, {
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
          instructions: true,
          language: 'fr',
        }),
      });
      if (!response.ok) {
        this.logger.warn(`ORS ${profile} HTTP ${response.status}`);
        return null;
      }

      const body = (await response.json()) as OrsGeoJsonResponse;
      const feature = body.features[0];
      const summary = feature?.properties.summary;
      if (!summary) {
        return null;
      }
      const coordinates = feature.geometry.coordinates;
      const steps = feature.properties.segments?.[0]?.steps ?? [];
      return {
        distanceMeters: summary.distance,
        durationSeconds: summary.duration,
        steps: steps.map((s) => {
          const [lon, lat] = coordinates[s.way_points[1]];
          return {
            instruction: s.instruction,
            distanceMeters: s.distance,
            durationSeconds: s.duration,
            type: s.type,
            location: { lat, lon },
          };
        }),
        geometry: coordinates.map(([lon, lat]) => ({ lat, lon })),
      };
    } catch (err) {
      this.logger.warn(`ORS ${profile} request failed: ${(err as Error).message}`);
      return null;
    }
  }
}
