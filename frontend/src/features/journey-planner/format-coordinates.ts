import type { Coordinates } from './types';

// ponytail: a picked point is labelled by its coordinates — GeocodingService
// is forward-only, so a readable street name would need a new reverse-geocode
// endpoint. Swap this for that call if the raw numbers ever bother users.
export function formatCoordinates({ lat, lon }: Coordinates): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
