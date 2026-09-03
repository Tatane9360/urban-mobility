import { apiFetch } from '@/src/lib/api-client';
import type { BikeStationsResponse } from '../types';

// Public endpoint — no token, a guest sees stations too.
export function fetchBikeStations(): Promise<BikeStationsResponse> {
  return apiFetch<BikeStationsResponse>('/bike-stations');
}
