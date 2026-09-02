'use client';

import { useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { ApiError } from '@/src/lib/api-client';
import { useAuth } from '../hooks/useAuth';
import { evaluatePasswordStrength } from '../password-strength';
import type { AuthResponse } from '../types';

interface AuthFormProps {
  title: string;
  submitLabel: string;
  minPasswordLength?: number;
  onSubmit: (email: string, password: string) => Promise<AuthResponse>;
  footer: React.ReactNode;
}

// Same accent for every strength band, no brand-green celebration for
// "strong" — DESIGN.md locks the accent and explicitly avoids a green
// system color, so the gauge signals through width and a neutral/red/amber
// vocabulary already used for other severity states in this app.
const STRENGTH_BAR_CLASS: Record<'weak' | 'fair' | 'strong', string> = {
  weak: 'bg-red-500',
  fair: 'bg-amber-500',
  strong: 'bg-accent',
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  error,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  error?: string | null;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <div
        className={`flex h-11 items-center rounded-lg border bg-white pl-3 pr-1 focus-within:border-accent dark:bg-zinc-900 ${
          error ? 'border-red-400 dark:border-red-800' : 'border-zinc-200 dark:border-zinc-800'
        }`}
      >
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-50"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-accent dark:hover:bg-zinc-800"
        >
          {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthForm({ title, submitLabel, minPasswordLength, onSubmit, footer }: AuthFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const strengthId = useId();
  const router = useRouter();
  const { setToken } = useAuth();

  const isRegister = minPasswordLength !== undefined;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const confirmError =
    isRegister && confirmTouched && confirmPassword !== password ? 'Les mots de passe ne correspondent pas.' : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isRegister && confirmPassword !== password) {
      setConfirmTouched(true);
      return;
    }
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
            className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-accent dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div>
          <PasswordField
            id={passwordId}
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            minLength={minPasswordLength}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            describedBy={isRegister ? strengthId : undefined}
          />

          {/* Gauge only makes sense while creating a password, not while
              typing an existing one to log in. */}
          {isRegister && (
            <div id={strengthId} className="mt-2" aria-live="polite">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${STRENGTH_BAR_CLASS[strength.strength]}`}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
              {strength.label && (
                <p
                  className={`mt-1 text-xs ${
                    strength.strength === 'weak'
                      ? 'text-red-700 dark:text-red-400'
                      : strength.strength === 'fair'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {strength.label}
                </p>
              )}
            </div>
          )}
        </div>

        {isRegister && (
          <PasswordField
            id={confirmId}
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(v) => {
              setConfirmPassword(v);
              if (confirmTouched) setConfirmTouched(false);
            }}
            autoComplete="new-password"
            error={confirmError}
            describedBy={confirmError ? `${confirmId}-error` : undefined}
          />
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-lg bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Patientez…' : submitLabel}
        </button>
      </form>

      {footer}
    </div>
  );
}
