'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useSavedJourneys } from '@/src/features/journey-history/hooks/useSavedJourneys';
import { SavedJourneysList } from '@/src/features/journey-history/components/SavedJourneysList';

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { journeys, loading: journeysLoading } = useSavedJourneys();

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
      <SavedJourneysList journeys={journeys} loading={journeysLoading} />
    </div>
  );
}
