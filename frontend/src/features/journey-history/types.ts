import { TransportMode, type JourneyWaypoint } from '../journey-planner/types';

// Mirrors backend/src/journeys/dto/saved-journey-response.dto.ts — note this
// endpoint never returns distanceMeters, so carComparison (which needs it,
// see CarbonService.carComparison) cannot be reconstructed here.
export interface SavedJourneySegment {
  mode: TransportMode;
  durationSeconds: number;
  carbonGrams: number;
  from: JourneyWaypoint;
  to: JourneyWaypoint;
}

export interface SavedJourney {
  id: string;
  segments: SavedJourneySegment[];
  durationSeconds: number;
  carbonGrams: number;
  degraded: boolean;
  savedAt: string;
}
