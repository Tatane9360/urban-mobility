'use client';

import { useAlerts } from '@/src/features/alerts/hooks/useAlerts';
import { AlertsList } from '@/src/features/alerts/components/AlertsList';

export default function AlertsPage() {
  const { alerts, loading, error } = useAlerts();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Perturbations
      </h1>
      <AlertsList alerts={alerts} loading={loading} error={error} />
    </div>
  );
}
