'use client';

import { useState } from 'react';
import { Bicycle, PersonSimpleWalk, Train, Bus, CaretDown } from '@phosphor-icons/react/dist/ssr';
import { Leaf } from '@phosphor-icons/react/dist/ssr';
import { TransportMode, type JourneyStep } from '../types';
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
    steps?: JourneyStep[];
  };
}

export function SegmentBadge({ segment }: SegmentBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = MODE_ICON[segment.mode];
  const isMotorized = segment.mode === TransportMode.Tram || segment.mode === TransportMode.Bus;
  const hasSteps = Boolean(segment.steps && segment.steps.length > 0);
  const hasDetail = Boolean(segment.from.name || segment.to.name || hasSteps);

  return (
    <div
      className={`overflow-hidden rounded-lg border text-xs font-medium ${
        isMotorized
          ? 'border-[#1E3A5F]/20 bg-[#1E3A5F]/5 text-[#1E3A5F] dark:border-[#3B6EA5]/30 dark:bg-[#3B6EA5]/10 dark:text-[#3B6EA5]'
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
          {hasDetail && (
            <CaretDown
              size={12}
              className={`ml-auto shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          )}
        </div>
        {isMotorized && segment.tripHeadsign && (
          <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
            Direction {segment.tripHeadsign}
          </span>
        )}
      </button>

      {expanded && hasDetail && (
        <div className="flex flex-col gap-1 border-t border-current/10 px-2.5 py-2 text-[11px] font-normal text-zinc-600 dark:text-zinc-400">
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
