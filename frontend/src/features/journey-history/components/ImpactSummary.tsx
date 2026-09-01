import { Bicycle, Bus, Leaf, PersonSimpleWalk, Train } from '@phosphor-icons/react/dist/ssr';
import { TransportMode } from '../../journey-planner/types';
import type { SavedJourneyStats } from '../types';

const MODE_ICON: Record<TransportMode, typeof Train> = {
  [TransportMode.Tram]: Train,
  [TransportMode.Bus]: Bus,
  [TransportMode.Velo]: Bicycle,
  [TransportMode.Marche]: PersonSimpleWalk,
};

// Mirrors SegmentBadge's motorized/soft-mode split so the two screens read as
// one palette. Never the sole carrier of meaning: every bar is also labelled
// with its mode name and its share in text.
const MODE_BAR: Record<TransportMode, string> = {
  [TransportMode.Tram]: 'bg-accent',
  [TransportMode.Bus]: 'bg-accent',
  [TransportMode.Velo]: 'bg-emerald-600 dark:bg-emerald-500',
  [TransportMode.Marche]: 'bg-emerald-600 dark:bg-emerald-500',
};

function formatGrams(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`;
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </dd>
      {hint && <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

export function ImpactSummary({
  stats,
  loading,
}: {
  stats: SavedJourneyStats | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div
        className="mb-6 h-40 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        aria-busy="true"
        aria-label="Chargement de mon impact"
      />
    );
  }

  // No stats at all (request failed) or nothing saved yet: the empty state of
  // SavedJourneysList already explains what to do, so stay quiet here.
  if (!stats || stats.journeyCount === 0) {
    return null;
  }

  // Distance-based shares: a 0 g Marche/Vélo mode would otherwise be invisible
  // in a carbon-weighted breakdown, which is exactly the mode worth showing.
  const totalDistance = stats.byMode.reduce((total, entry) => total + entry.distanceMeters, 0);

  return (
    <section
      aria-labelledby="impact-heading"
      className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2
        id="impact-heading"
        className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
      >
        <Leaf size={16} aria-hidden="true" />
        Mon impact
      </h2>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Sur {stats.journeyCount} itinéraire{stats.journeyCount > 1 ? 's' : ''} sauvegardé
        {stats.journeyCount > 1 ? 's' : ''}.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="CO₂ évité"
          value={formatGrams(stats.savedCarbonGrams)}
          hint={`${Math.round(stats.savedPercent)} % de moins qu'en voiture`}
        />
        <Stat
          label="Équivalent voiture"
          value={formatGrams(stats.carCarbonGrams)}
          hint={`Pour ${formatDistance(stats.distanceMeters)} parcourus`}
        />
        <Stat label="CO₂ émis" value={formatGrams(stats.carbonGrams)} />
        <Stat label="Temps cumulé" value={formatDuration(stats.durationSeconds)} />
      </dl>

      {totalDistance > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Répartition par mode
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {[...stats.byMode]
              .sort((a, b) => b.distanceMeters - a.distanceMeters)
              .map((entry) => {
                const Icon = MODE_ICON[entry.mode];
                const share = Math.round((entry.distanceMeters / totalDistance) * 100);
                return (
                  <li key={entry.mode} className="flex items-center gap-2 text-xs">
                    <Icon size={14} aria-hidden="true" className="shrink-0 text-zinc-500" />
                    <span className="w-14 shrink-0 text-zinc-700 dark:text-zinc-300">
                      {entry.mode}
                    </span>
                    <span
                      className="h-1.5 min-w-[2px] grow rounded-full bg-zinc-100 dark:bg-zinc-800"
                      aria-hidden="true"
                    >
                      <span
                        className={`block h-full rounded-full ${MODE_BAR[entry.mode]}`}
                        style={{ width: `${share}%` }}
                      />
                    </span>
                    <span className="w-32 shrink-0 text-right text-zinc-600 dark:text-zinc-400">
                      {share} % · {formatDistance(entry.distanceMeters)} ·{' '}
                      {formatGrams(entry.carbonGrams)}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </section>
  );
}
