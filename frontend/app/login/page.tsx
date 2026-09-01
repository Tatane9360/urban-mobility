'use client';

import Link from 'next/link';
import { AuthForm } from '@/src/features/auth/components/AuthForm';
import { login } from '@/src/features/auth/api/login';

export default function LoginPage() {
  return (
    <AuthForm
      title="Connexion"
      submitLabel="Se connecter"
      onSubmit={login}
      footer={
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pas encore de compte ?{' '}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Créer un compte
          </Link>
        </p>
      }
    />
  );
}
