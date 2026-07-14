import { apiFetch } from '@/src/lib/api-client';
import type { AuthResponse } from '../types';

export function register(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
