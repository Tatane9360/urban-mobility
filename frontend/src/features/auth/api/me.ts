import { apiFetch } from '@/src/lib/api-client';
import type { CurrentUser } from '../types';

export function getCurrentUser(token: string): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
