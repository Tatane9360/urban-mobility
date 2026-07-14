import { apiFetch } from '@/src/lib/api-client';
import type { Profile } from '../types';

export function getProfile(token: string): Promise<Profile> {
  return apiFetch<Profile>('/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
