import { CarComparison } from '../carbon/emission-factor';
import { JourneySegment } from './journey-segment';

export interface Journey {
  segments: JourneySegment[];
  durationSeconds: number;
  carbonGrams: number;
  carComparison: CarComparison;
  // True when GTFS-RT was unavailable and the planner fell back to static
  // schedules. Set by the planner, not the provider: BusTramMobilityProvider
  // never reads GTFS-RT at all.
  degraded: boolean;
}
