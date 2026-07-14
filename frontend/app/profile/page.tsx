'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { ProfileForm } from '@/src/features/profile/components/ProfileForm';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, saving, save } = useProfile();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  if (authLoading || profileLoading || !profile) {
    return <div className="flex-1 p-4" />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Mon profil
      </h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">{user?.email}</p>
      <ProfileForm profile={profile} saving={saving} onSave={save} />
    </div>
  );
}
