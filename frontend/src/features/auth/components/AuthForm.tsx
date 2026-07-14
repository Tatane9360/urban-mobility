'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/src/lib/api-client';
import { useAuth } from '../hooks/useAuth';
import type { AuthResponse } from '../types';

interface AuthFormProps {
  title: string;
  submitLabel: string;
  minPasswordLength?: number;
  onSubmit: (email: string, password: string) => Promise<AuthResponse>;
  footer: React.ReactNode;
}

export function AuthForm({ title, submitLabel, minPasswordLength, onSubmit, footer }: AuthFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const router = useRouter();
  const { setToken } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { accessToken } = await onSubmit(email, password);
      setToken(accessToken);
      router.push('/');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Une erreur est survenue, réessayez.',
      );
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-4">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor={emailId} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[#1E3A5F] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-[#3B6EA5]"
          />
        </div>

        <div>
          <label htmlFor={passwordId} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Mot de passe
          </label>
          <input
            id={passwordId}
            type="password"
            required
            minLength={minPasswordLength}
            autoComplete={minPasswordLength ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[#1E3A5F] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-[#3B6EA5]"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-lg bg-[#1E3A5F] text-sm font-medium text-white transition-colors hover:bg-[#16293F] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#3B6EA5] dark:hover:bg-[#4E82BA]"
        >
          {loading ? 'Patientez…' : submitLabel}
        </button>
      </form>

      {footer}
    </div>
  );
}
