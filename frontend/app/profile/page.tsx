'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { ProfileForm } from '@/src/features/profile/components/ProfileForm';
import { UserDataSection } from '@/src/features/profile/components/UserDataSection';
import { GeolocationConsentSection } from '@/src/features/profile/components/GeolocationConsentSection';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, loadError, saving, saveError, saved, save, retryLoad } =
    useProfile();

  // A deleted account clears the token on its way to the planner; without this
  // the guard below would fire first and bounce it to /login instead.
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!leaving && !authLoading && !user) {
      router.replace('/login');
    }
  }, [leaving, authLoading, user, router]);

  if (authLoading || profileLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 p-4" aria-busy="true">
        <div className="h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-6 h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      </div>
    );
  }

  // Without this a failed fetch left `profile` null forever and the page
  // rendered an empty div with no message and no way out.
  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 p-4">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Mon profil
        </h1>
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
        >
          <p>
            {loadError
              ? 'Impossible de charger votre profil pour le moment.'
              : 'Votre profil est indisponible.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={retryLoad}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-800 dark:bg-red-900 dark:hover:bg-red-800"
            >
              Réessayer
            </button>
            <Link
              href="/"
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              Retour au planificateur
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Mon profil
      </h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">{user?.email}</p>
      <ProfileForm profile={profile} saving={saving} saved={saved} error={saveError} onSave={save} />
      <GeolocationConsentSection />
      {user && <UserDataSection email={user.email} onLeaving={() => setLeaving(true)} />}
    </div>
  );
}
