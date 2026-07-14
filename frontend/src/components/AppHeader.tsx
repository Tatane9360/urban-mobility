'use client';

import Link from 'next/link';
import { useAuth } from '@/src/features/auth/hooks/useAuth';

export function AppHeader() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
      <Link href="/" className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        UrbanFlow
      </Link>

      {!loading && (
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/history" className="font-medium text-zinc-700 hover:text-[#1E3A5F] dark:text-zinc-300 dark:hover:text-[#3B6EA5]">
                Historique
              </Link>
              <Link href="/profile" className="font-medium text-zinc-700 hover:text-[#1E3A5F] dark:text-zinc-300 dark:hover:text-[#3B6EA5]">
                Profil
              </Link>
              <button
                type="button"
                onClick={logout}
                className="font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 font-medium text-white transition-colors hover:bg-[#16293F] dark:bg-[#3B6EA5] dark:hover:bg-[#4E82BA]"
            >
              Connexion
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
