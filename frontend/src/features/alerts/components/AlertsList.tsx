'use client';

import { useMemo, useState } from 'react';
import { Warning } from '@phosphor-icons/react/dist/ssr';
import type { ServiceAlert } from '../../journey-planner/types';

interface AlertsListProps {
  alerts: ServiceAlert[];
  loading: boolean;
  error: boolean;
}

export function AlertsList({ alerts, loading, error }: AlertsListProps) {
  // Every line touched by an active alert, in a stable sorted order — the
  // filter set itself, not just its labels.
  const lines = useMemo(
    () => Array.from(new Set(alerts.flatMap((a) => a.routeIds))).sort(),
    [alerts],
  );
  // Empty selection reads as "no filter" rather than "nothing selected", so a
  // guest never lands on an empty list by default.
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());

  function toggleLine(line: string) {
    setSelectedLines((current) => {
      const next = new Set(current);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  }

  const filtered =
    selectedLines.size === 0 ? alerts : alerts.filter((a) => a.routeIds.some((r) => selectedLines.has(r)));

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
      {lines.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par ligne">
          {lines.map((line) => {
            const active = selectedLines.has(line);
            return (
              <button
                key={line}
                type="button"
                aria-pressed={active}
                onClick={() => toggleLine(line)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700'
                }`}
              >
                {line}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Aucune perturbation sur les lignes sélectionnées.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((alert) => (
            <li
              key={alert.id}
              className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <Warning size={16} weight="fill" className="mt-0.5 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{alert.header}</span>
                {alert.description && <span className="text-xs opacity-90">{alert.description}</span>}
                {alert.routeIds.length > 0 && (
                  <span className="text-xs opacity-75">Lignes concernées : {alert.routeIds.join(', ')}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
