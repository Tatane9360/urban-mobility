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
  const { user, loading: authLoading } = useAuth();
  const { journeys, loading: journeysLoading, remove } = useSavedJourneys();
  const { stats, loading: statsLoading } = useSavedJourneyStats();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return <div className="flex-1 p-4" />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Mes itinéraires sauvegardés
      </h1>
      <ImpactSummary stats={stats} loading={statsLoading} />
      <SavedJourneysList journeys={journeys} loading={journeysLoading} onDelete={remove} />
    </div>
  );
}
