import { apiFetch } from '@/src/lib/api-client';
import type { UserDataExport } from '../types';

export function exportUserData(token: string): Promise<UserDataExport> {
  return apiFetch<UserDataExport>('/auth/me/export', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function deleteAccount(token: string): Promise<void> {
  return apiFetch<void>('/auth/me', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
