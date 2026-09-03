import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeocodeResult } from './geocoding.types';

// Montpellier Méditerranée Métropole bounding box, hand-picked from the
// metropole's public boundaries — enough to restrict Nominatim results without
// importing a shapefile.
const MMM_VIEWBOX = '3.75,43.70,4.05,43.55';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Nominatim's usage policy requires an identifying User-Agent and at most
// ~1 req/s. The rate limit is NOT enforced here — add it before any real
// traffic, or the public instance will block this client.
const USER_AGENT = 'UrbanFlowMobility/1.0 (contact: tatanemkd@gmail.com)';

interface NominatimEntry {
  display_name: string;
  lat: string;
  lon: string;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  async geocode(query: string): Promise<GeocodeResult[]> {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('viewbox', MMM_VIEWBOX);
    url.searchParams.set('bounded', '1');

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      this.logger.error(`Nominatim HTTP ${response.status}`);
      throw new ServiceUnavailableException('Geocoding service unavailable');
    }

    const body = (await response.json()) as NominatimEntry[];
    return body.map((entry) => ({
      displayName: entry.display_name,
      lat: parseFloat(entry.lat),
      lon: parseFloat(entry.lon),
    }));
  }
}
