'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useSavedJourneys } from '@/src/features/journey-history/hooks/useSavedJourneys';
import { useSavedJourneyStats } from '@/src/features/journey-history/hooks/useSavedJourneyStats';
import { SavedJourneysList } from '@/src/features/journey-history/components/SavedJourneysList';
import { ImpactSummary } from '@/src/features/journey-history/components/ImpactSummary';

export default function HistoryPage() {
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();
  const { journeys, loading: journeysLoading, offline, remove } = useSavedJourneys();
  const { stats, loading: statsLoading } = useSavedJourneyStats();

  // Gated on the token, not on `user`: offline the /auth/me call can't
  // resolve, and requiring the loaded profile would bounce a signed-in user to
  // /login instead of showing the journeys cached for exactly this case.
  useEffect(() => {
    if (!authLoading && !token) {
      router.replace('/login');
    }
  }, [authLoading, token, router]);

  if (authLoading || !token) {
    return <div className="flex-1 p-4" />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Mes itinéraires sauvegardés
      </h1>
      {offline && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Vous êtes hors ligne. Voici vos derniers itinéraires enregistrés sur cet appareil.
        </p>
      )}
      <ImpactSummary stats={stats} loading={statsLoading} />
      <SavedJourneysList journeys={journeys} loading={journeysLoading} onDelete={remove} />
    </div>
  );
}
