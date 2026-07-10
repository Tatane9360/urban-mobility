import { JourneySegment } from './journey-segment';

export interface Journey {
  segments: JourneySegment[];
  durationSeconds: number;
  // ponytail: true when GTFS-RT was unavailable and the planner fell back to
  // static GTFS schedules (see ADR-less acceptance criterion on #12) — a
  // planner-level signal, since BusTramMobilityProvider itself never reads
  // GTFS-RT at all (static schedule query only).
  degraded: boolean;
}
