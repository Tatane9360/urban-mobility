import {
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowUUpLeft,
  ArrowUUpRight,
  MapPinLine,
  ArrowsClockwise,
} from '@phosphor-icons/react/dist/ssr';
import type { JourneyStep } from '../types';

// ORS's own maneuver type codes (https://openrouteservice.org, Directions
// API "steps"): 0/1 turn left/right, 2/3 sharp left/right, 4/5 slight
// left/right, 6 straight, 7/8 roundabout enter/exit, 9 U-turn, 10 arrive,
// 11 depart, 12/13 U-turn left/right (some profiles reuse 9 for both).
const STEP_ICON: Record<number, typeof ArrowUp> = {
  0: ArrowLeft,
  1: ArrowRight,
  2: ArrowBendUpLeft,
  3: ArrowBendUpRight,
  4: ArrowUpLeft,
  5: ArrowUpRight,
  6: ArrowUp,
  7: ArrowsClockwise,
  8: ArrowsClockwise,
  9: ArrowUUpLeft,
  10: MapPinLine,
  11: ArrowUp,
  12: ArrowUUpLeft,
  13: ArrowUUpRight,
};

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function JourneySteps({ steps }: { steps: JourneyStep[] }) {
  if (steps.length === 0) return null;

  return (
    <ol className="flex flex-col divide-y divide-current/10">
      {steps.map((step, index) => {
        const Icon = STEP_ICON[step.type] ?? ArrowUp;
        return (
          <li key={index} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
            <Icon size={14} weight="bold" className="mt-0.5 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span>{step.instruction}</span>
              {step.distanceMeters > 0 && (
                <span className="text-zinc-400 dark:text-zinc-500">{formatDistance(step.distanceMeters)}</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
