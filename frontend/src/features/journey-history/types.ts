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

// Mirrors backend/src/journeys/dto/saved-journey-stats.dto.ts — the
// cumulative footprint, aggregated server-side over the user's saved
// Journeys (the car baseline needs distanceMeters, which the per-Journey
// list endpoint above does not return).
export interface SavedJourneyModeStats {
  mode: TransportMode;
  journeySegments: number;
  durationSeconds: number;
  distanceMeters: number;
  carbonGrams: number;
}

export interface SavedJourneyStats {
  journeyCount: number;
  durationSeconds: number;
  distanceMeters: number;
  carbonGrams: number;
  carCarbonGrams: number;
  savedCarbonGrams: number;
  savedPercent: number;
  byMode: SavedJourneyModeStats[];
}
