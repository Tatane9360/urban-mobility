import type { Coordinates } from './types';

// A picked point is labelled by its coordinates: GeocodingService is
// forward-only, so a street name would need a new reverse-geocode endpoint.
export function formatCoordinates({ lat, lon }: Coordinates): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
