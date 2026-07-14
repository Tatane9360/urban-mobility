import { apiFetch } from '@/src/lib/api-client';
import type { GeocodeResult } from '../types';

export function geocode(query: string): Promise<GeocodeResult[]> {
  return apiFetch<GeocodeResult[]>(`/geocode?q=${encodeURIComponent(query)}`);
}
