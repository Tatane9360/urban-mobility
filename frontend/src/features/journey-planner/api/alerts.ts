import { apiFetch } from '@/src/lib/api-client';
import type { ServiceAlert } from '../types';

// Public endpoint — no token, a guest sees disruptions too.
export function fetchAlerts(): Promise<ServiceAlert[]> {
  return apiFetch<ServiceAlert[]>('/alerts');
}
