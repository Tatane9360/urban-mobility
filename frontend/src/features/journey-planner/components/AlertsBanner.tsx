'use client';

import { useEffect, useState } from 'react';
import { Warning } from '@phosphor-icons/react/dist/ssr';
import { fetchAlerts } from '../api/alerts';
import type { ServiceAlert } from '../types';

// Fetched once on mount, not polled: this banner is informational and the
// planner page is short-lived. The /alerts page uses useAlerts, which does
// poll — reuse that hook here if a mid-session disruption ever matters.
export function AlertsBanner() {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    // A failing /alerts must never break the planner — no disruption info is
    // the same outcome as no disruptions, for this banner.
    fetchAlerts()
      .then((result) => {
        if (!cancelled) setAlerts(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <section
      aria-label="Perturbations en cours"
      className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      {alerts.map((alert) => (
        <div key={alert.id} className="flex items-start gap-2">
          <Warning size={16} weight="fill" className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{alert.header}</span>
            {alert.description && (
              <span className="text-xs opacity-90">{alert.description}</span>
            )}
            {alert.routeIds.length > 0 && (
              <span className="text-xs opacity-75">
                Lignes concernées : {alert.routeIds.join(', ')}
              </span>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
