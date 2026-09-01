'use client';

import { useState } from 'react';
import { Bicycle, PersonSimpleWalk, Train, Bus, CaretDown, Warning } from '@phosphor-icons/react/dist/ssr';
import { Leaf } from '@phosphor-icons/react/dist/ssr';
import { TransportMode, type JourneyStep, type ServiceAlert } from '../types';
import { JourneySteps } from './JourneySteps';

const MODE_ICON: Record<TransportMode, typeof Train> = {
  [TransportMode.Tram]: Train,
  [TransportMode.Bus]: Bus,
  [TransportMode.Velo]: Bicycle,
  [TransportMode.Marche]: PersonSimpleWalk,
};

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? '<1 min' : `${minutes} min`;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// The theoretical clock time behind a real-time one: subtract the delay the
// backend already folded into startTime, so the rider sees both.
function shiftClock(iso: string, seconds: number): string {
  return formatClock(new Date(new Date(iso).getTime() - seconds * 1000).toISOString());
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatGrams(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`;
}

interface SegmentBadgeProps {
  segment: {
    mode: TransportMode;
    durationSeconds: number;
    distanceMeters?: number;
    carbonGrams: number;
    from: { name: string };
    to: { name: string };
    startTime?: string;
    endTime?: string;
    routeShortName?: string | null;
    tripHeadsign?: string | null;
    realtime?: boolean;
    delaySeconds?: number;
    alerts?: ServiceAlert[];
    steps?: JourneyStep[];
  };
}

export function SegmentBadge({ segment }: SegmentBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = MODE_ICON[segment.mode];
  const isMotorized = segment.mode === TransportMode.Tram || segment.mode === TransportMode.Bus;
  const hasSteps = Boolean(segment.steps && segment.steps.length > 0);
  const delaySeconds = segment.delaySeconds ?? 0;
  const isLate = Boolean(segment.realtime) && delaySeconds > 0;
  const alerts = segment.alerts ?? [];
  const hasDetail = Boolean(segment.from.name || segment.to.name || hasSteps || alerts.length > 0);

  return (
    <div
      className={`overflow-hidden rounded-lg border text-xs font-medium ${
        isMotorized
          ? 'border-accent/20 bg-accent/5 text-accent'
          : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400'
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (hasDetail) setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
        className={`flex w-full flex-col gap-1 px-2.5 py-1.5 text-left ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-1.5">
          <Icon size={14} weight="bold" />
          <span>{isMotorized && segment.routeShortName ? `${segment.mode} ${segment.routeShortName}` : segment.mode}</span>
          <span className="text-zinc-400 dark:text-zinc-500">·</span>
          <span>{formatDuration(segment.durationSeconds)}</span>
          {segment.startTime && segment.endTime && (
            <>
              <span className="text-zinc-400 dark:text-zinc-500">·</span>
              <span>
                {formatClock(segment.startTime)} - {formatClock(segment.endTime)}
              </span>
            </>
          )}
          {isLate && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
              +{Math.round(delaySeconds / 60)} min
            </span>
          )}
          {alerts.length > 0 && (
            <Warning
              size={13}
              weight="fill"
              aria-label={`${alerts.length} perturbation${alerts.length > 1 ? 's' : ''} sur cette ligne`}
              className="shrink-0 text-amber-600 dark:text-amber-400"
            />
          )}
          {hasDetail && (
            <CaretDown
              size={12}
              className={`ml-auto shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          )}
        </div>
        {isMotorized && segment.tripHeadsign && (
          <span className="text-xs font-normal text-zinc-600 dark:text-zinc-400">
            Direction {segment.tripHeadsign}
          </span>
        )}
        {isLate && segment.startTime && (
          <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
            Départ temps réel {formatClock(segment.startTime)} (théorique{' '}
            {shiftClock(segment.startTime, delaySeconds)})
          </span>
        )}
      </button>

      {expanded && hasDetail && (
        <div className="flex flex-col gap-1 border-t border-current/10 px-2.5 py-2 text-xs font-normal text-zinc-600 dark:text-zinc-400">
          {segment.from.name && <span>De : {segment.from.name}</span>}
          {segment.to.name && <span>À : {segment.to.name}</span>}
          <div className="flex items-center gap-1.5 pt-0.5">
            {segment.distanceMeters !== undefined && (
              <>
                <span>{formatDistance(segment.distanceMeters)}</span>
                <span className="text-zinc-400 dark:text-zinc-500">·</span>
              </>
            )}
            <Leaf size={12} />
            <span>{formatGrams(segment.carbonGrams)} CO₂e</span>
          </div>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="mt-1 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
            >
              <Warning size={13} weight="fill" className="mt-0.5 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{alert.header}</span>
                {alert.description && <span>{alert.description}</span>}
              </div>
            </div>
          ))}
          {hasSteps && (
            <div className="mt-1 border-t border-current/10 pt-1.5">
              <JourneySteps steps={segment.steps!} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
