import { apiFetch } from '@/src/lib/api-client';
import type { Profile, UpdateProfileRequest } from '../types';

export function updateProfile(token: string, update: UpdateProfileRequest): Promise<Profile> {
  return apiFetch<Profile>('/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(update),
  });
}
