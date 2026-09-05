'use client';

import { Warning } from '@phosphor-icons/react/dist/ssr';
import type { ServiceAlert } from '../../journey-planner/types';

interface AlertsListProps {
  alerts: ServiceAlert[];
  loading: boolean;
  error: boolean;
}

export function AlertsList({ alerts, loading, error }: AlertsListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700 dark:text-red-400">
        Impossible de charger les perturbations pour le moment.
      </p>
    );
  }

  if (alerts.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Aucune perturbation en cours sur le réseau.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <Warning size={16} weight="fill" className="mt-0.5 shrink-0" />
            {/* description is TaM's rider-facing French text; header is an internal ticket code, used only as fallback. */}
            <span className="font-medium">{alert.description || alert.header}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
