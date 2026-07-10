import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeocodeResult } from './geocoding.types';

// ponytail: Montpellier Méditerranée Métropole bounding box (viewbox), hand-picked
// from the metropole's public boundaries — good enough to bias/restrict Nominatim
// results without pulling in a shapefile for the MVP.
const MMM_VIEWBOX = '3.75,43.70,4.05,43.55';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// ponytail: Nominatim's usage policy requires a real, identifying User-Agent
// and at most ~1 req/s — the KPI-relevant part (rate limiting) is left to the
// caller for now since the MVP has no meaningful traffic yet.
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
