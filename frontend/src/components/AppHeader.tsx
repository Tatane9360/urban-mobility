'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { Logo } from './Logo';

export function AppHeader() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  // Both auth pages already end in a submit button doing exactly this — a
  // second "Connexion" in the header pointing at the page the user is
  // already on is a dead link dressed up as a repeat of the same action.
  const onAuthPage = pathname === '/login' || pathname === '/register';

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
      <Logo />

      {!loading && (
        <nav className="flex items-center gap-4 text-sm">
          {/* Guest-visible, same intent as the public /alerts endpoint — kept
              outside the user-gated branch below. */}
          <Link
            href="/alerts"
            className="hidden font-medium text-zinc-700 hover:text-accent lg:inline dark:text-zinc-300"
          >
            Alertes
          </Link>
          {user ? (
            <>
              {/* Below lg, MobileTabBar carries these two — kept here only
                  for pointer-driven desktop nav. */}
              <Link
                href="/history"
                className="hidden font-medium text-zinc-700 hover:text-accent lg:inline dark:text-zinc-300"
              >
                Historique
              </Link>
              <Link
                href="/profile"
                className="hidden font-medium text-zinc-700 hover:text-accent lg:inline dark:text-zinc-300"
              >
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
            !onAuthPage && (
              <Link
                href="/login"
                className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Connexion
              </Link>
            )
          )}
        </nav>
      )}
    </header>
  );
}
