import { GeoPoint } from './geo-point';

const EARTH_RADIUS_METERS = 6371000;

// ponytail: Haversine great-circle distance — no external routing API in
// this ticket, straight-line distance is the deliberate fallback (see #11).
export function haversineDistanceMeters(from: GeoPoint, to: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
