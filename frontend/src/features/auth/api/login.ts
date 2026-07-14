import { apiFetch } from '@/src/lib/api-client';
import type { AuthResponse } from '../types';

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
