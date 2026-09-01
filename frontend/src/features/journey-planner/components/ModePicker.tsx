import { Bicycle, PersonSimpleWalk, Train } from '@phosphor-icons/react/dist/ssr';
import { TransportMode, type Journey } from '../types';

// Bus and Tram share one icon slot here — a Journey chains modes, it never
// mixes Bus and Tram in the same candidate for this MVP's routing, so
// "transit" reads as one picker entry rather than two near-duplicates.
//
// Matches on the whole Journey, not "does any segment use this mode" — every
// Vélo/transit candidate also carries bridging Marche segments at either end
// (see JourneyPlannerService.withBridgingWalks), so a naive per-segment match
// would make the Marche icon just alias whichever candidate happens fastest.
// "Marche" means walk-only; Vélo/Transport mean "this mode is the core leg".
const PICKER_MODES: { label: string; icon: typeof Train; matches: (journey: Journey) => boolean }[] = [
  {
    label: 'Marche',
    icon: PersonSimpleWalk,
    matches: (j) => j.segments.every((s) => s.mode === TransportMode.Marche),
  },
  {
    label: 'Vélo',
    icon: Bicycle,
    matches: (j) => j.segments.some((s) => s.mode === TransportMode.Velo),
  },
  {
    label: 'Transport',
    icon: Train,
    matches: (j) => j.segments.some((s) => s.mode === TransportMode.Tram || s.mode === TransportMode.Bus),
  },
];

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours} h ${remainder} min` : `${minutes} min`;
}

interface ModePickerProps {
  journeys: Journey[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

// One entry per mode present across ALL candidates the planner returned for
// this search (not per-segment within one Journey) — clicking an icon jumps
// to that mode's best (shortest) candidate, mirroring a per-mode duration
// picker without re-querying the backend (it already returned every candidate).
export function ModePicker({ journeys, selectedIndex, onSelect }: ModePickerProps) {
  if (journeys.length === 0) return null;

  const entries = PICKER_MODES.map(({ label, icon, matches }) => {
    let bestIndex: number | null = null;
    for (let i = 0; i < journeys.length; i++) {
      if (!matches(journeys[i])) continue;
      if (bestIndex === null || journeys[i].durationSeconds < journeys[bestIndex].durationSeconds) {
        bestIndex = i;
      }
    }
    return { label, icon, bestIndex };
  });

  if (entries.every((e) => e.bestIndex === null)) return null;

  return (
    <div className="flex gap-2 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
      {entries.map(({ label, icon: Icon, bestIndex }) => {
        const available = bestIndex !== null;
        const active = available && bestIndex === selectedIndex;
        return (
          <button
            key={label}
            type="button"
            disabled={!available}
            onClick={() => available && onSelect(bestIndex)}
            aria-label={
              available
                ? `${label} — ${formatDuration(journeys[bestIndex].durationSeconds)}`
                : `${label} — aucun itinéraire`
            }
            className={`flex flex-1 flex-col items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
              active
                ? 'bg-accent text-white'
                : available
                  ? 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  : 'cursor-not-allowed text-zinc-300 dark:text-zinc-700'
            }`}
          >
            <Icon size={18} weight="bold" aria-hidden="true" />
            <span className="font-medium">{label}</span>
            <span className={available ? undefined : 'opacity-60'}>
              {available ? formatDuration(journeys[bestIndex].durationSeconds) : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
