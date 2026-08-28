import { TransportMode } from '../../common/transport-mode.enum';

export interface SavedJourneyModeStats {
  mode: TransportMode;
  journeySegments: number;
  durationSeconds: number;
  distanceMeters: number;
  carbonGrams: number;
}

// The cumulative personal footprint of PRD's carbon calculator "Should have".
// carCarbonGrams/savedCarbonGrams/savedPercent come from
// CarbonService.carComparison, so the car baseline stays defined in exactly
// one place (emission-factor.ts).
export class SavedJourneyStatsDto {
  journeyCount: number;
  durationSeconds: number;
  distanceMeters: number;
  carbonGrams: number;
  carCarbonGrams: number;
  savedCarbonGrams: number;
  savedPercent: number;
  byMode: SavedJourneyModeStats[];
}
