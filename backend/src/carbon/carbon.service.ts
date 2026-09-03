import { Injectable } from '@nestjs/common';
import {
  CarbonedJourneySegment,
  RawJourneySegment,
} from '../routing/journey-segment';
import {
  CAR_EMISSION_FACTOR_G_PER_KM,
  CarComparison,
  EMISSION_FACTORS_G_PER_KM,
} from './emission-factor';

@Injectable()
export class CarbonService {
  // Uses the segment's own distanceMeters rather than re-deriving one from
  // from/to, so carbon stays consistent with the distance that actually
  // produced the segment's duration.
  withCarbon(segment: RawJourneySegment): CarbonedJourneySegment {
    const distanceKm = segment.distanceMeters / 1000;
    return {
      ...segment,
      carbonGrams: distanceKm * EMISSION_FACTORS_G_PER_KM[segment.mode],
    };
  }

  journeyCarbonGrams(segments: CarbonedJourneySegment[]): number {
    return segments.reduce((sum, segment) => sum + segment.carbonGrams, 0);
  }

  // Takes only { distanceMeters } rather than full segments: that is all the
  // car baseline needs, and it lets the cumulative footprint (#5) pass its
  // period totals as a single equivalent segment instead of re-deriving
  // CAR_EMISSION_FACTOR_G_PER_KM outside this file.
  carComparison(
    segments: Pick<CarbonedJourneySegment, 'distanceMeters'>[],
    journeyCarbonGrams: number,
  ): CarComparison {
    const totalDistanceKm =
      segments.reduce((sum, segment) => sum + segment.distanceMeters, 0) / 1000;
    const carCarbonGrams = totalDistanceKm * CAR_EMISSION_FACTOR_G_PER_KM;
    const savedCarbonGrams = carCarbonGrams - journeyCarbonGrams;
    const savedPercent =
      carCarbonGrams === 0 ? 0 : (savedCarbonGrams / carCarbonGrams) * 100;

    return { carCarbonGrams, savedCarbonGrams, savedPercent };
  }
}
