'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
    <Link
      href="/alerts"
      className="mt-2 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 lg:mt-0 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70"
    >
      <Warning size={16} weight="fill" className="shrink-0" />
      {alerts.length} perturbation{alerts.length > 1 ? 's' : ''} en cours
    </Link>
  );
}
