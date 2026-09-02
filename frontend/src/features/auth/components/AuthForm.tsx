'use client';

import { useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { Logo } from '@/src/components/Logo';
import { useAuth } from '../hooks/useAuth';
import { authErrorMessage } from '../auth-error-message';
import { evaluatePasswordStrength } from '../password-strength';
import type { AuthResponse } from '../types';

interface AuthFormProps {
  title: string;
  // One sentence naming what having an account actually buys the user —
  // an invité can already search journeys from `/`, so this is what
  // distinguishes signing up from just using the planner as a guest.
  subtitle: string;
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

// A single keystroke reading "faible" in red judges before the user has had
// any real chance to type a password — this delays the verdict (not the
// scoring itself) until there's enough length for "weak" to mean something.
const STRENGTH_DISPLAY_THRESHOLD = 4;

function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  minLength,
  error,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
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
          onBlur={onBlur}
          className="h-full w-full bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-50"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-accent dark:hover:bg-zinc-800"
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

export function AuthForm({ title, subtitle, submitLabel, minPasswordLength, onSubmit, footer }: AuthFormProps) {
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
      setError(authErrorMessage(err, isRegister));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-4">
      <div>
        {/* The same lockup AppHeader uses — this used to be a one-off
            icon+text pair local to this file, rendering a second, divergent
            version of the wordmark next to the header's plain-text one.
            Sharing the component is what keeps them from drifting again. */}
        <div className="mb-4">
          <Logo />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
      </div>

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

          {/* States the floor before the user hits it on submit — the gauge
              takes over as soon as there's something to grade. */}
          {isRegister && password.length === 0 && (
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              {minPasswordLength} caractères minimum.
            </p>
          )}

          {/* Gauge only makes sense while creating a password, not while
              typing an existing one to log in. */}
          {isRegister && password.length > 0 && (
            <div id={strengthId} className="mt-2" aria-live="polite">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    password.length < STRENGTH_DISPLAY_THRESHOLD
                      ? 'bg-zinc-400 dark:bg-zinc-600'
                      : STRENGTH_BAR_CLASS[strength.strength]
                  }`}
                  style={{ width: `${Math.max(strength.score, 8)}%` }}
                />
              </div>
              {password.length >= STRENGTH_DISPLAY_THRESHOLD && strength.label && (
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
            // Surfaces the mismatch as soon as the user leaves the field,
            // not only on a failed submit — but only once they've actually
            // typed something, so tabbing past an empty field stays quiet.
            onBlur={() => {
              if (confirmPassword) setConfirmTouched(true);
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

      {/* A guest can already search journeys from `/` with no account — this
          makes that path visible instead of the form reading as a wall. */}
      <Link
        href="/"
        className="text-center text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        Continuer sans compte
      </Link>
    </div>
  );
}
