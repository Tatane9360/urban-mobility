import { Leaf } from '@phosphor-icons/react/dist/ssr';
import type { CarComparison } from '../types';

function formatGrams(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`;
}

export function CarbonBadge({
  carbonGrams,
  carComparison,
}: {
  carbonGrams: number;
  carComparison: CarComparison;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
      <Leaf size={14} />
      <span>{formatGrams(carbonGrams)} CO₂e</span>
      {carComparison.savedPercent > 0 && (
        <span className="text-zinc-500 dark:text-zinc-400">
          · {Math.round(carComparison.savedPercent)}% vs voiture
        </span>
      )}
    </div>
  );
}
