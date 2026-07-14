'use client';

import Link from 'next/link';
import { AuthForm } from '@/src/features/auth/components/AuthForm';
import { register } from '@/src/features/auth/api/register';

export default function RegisterPage() {
  return (
    <AuthForm
      title="Créer un compte"
      submitLabel="Créer mon compte"
      minPasswordLength={8}
      onSubmit={register}
      footer={
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-medium text-[#1E3A5F] hover:underline dark:text-[#3B6EA5]">
            Se connecter
          </Link>
        </p>
      }
    />
  );
}
