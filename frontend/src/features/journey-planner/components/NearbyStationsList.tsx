'use client';

import { Bicycle } from '@phosphor-icons/react/dist/ssr';
import type { BikeStation } from '../types';
import { formatRelativeTime } from '../format-relative-time';
import { useNow } from '../hooks/useNow';

interface NearbyStationsListProps {
  stations: (BikeStation & { distanceMeters: number })[];
  fetchedAt: string | null;
}

export function NearbyStationsList({ stations, fetchedAt }: NearbyStationsListProps) {
  const now = useNow();

  if (stations.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Aucune station à moins d&apos;1 km de ce point.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {fetchedAt && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Disponibilité mise à jour {formatRelativeTime(fetchedAt, now)}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {stations.map((station) => (
          <li
            key={station.stationId}
            className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <Bicycle size={16} weight="fill" className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="font-medium text-zinc-900 dark:text-zinc-50">{station.name}</span>
              <span className="text-xs opacity-75">
                {Math.round(station.distanceMeters)} m ·{' '}
                {station.bikesAvailable !== undefined && station.docksAvailable !== undefined
                  ? `${station.bikesAvailable} vélo(s) · ${station.docksAvailable} place(s)`
                  : 'Disponibilité inconnue'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
