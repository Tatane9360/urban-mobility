import { Injectable } from '@nestjs/common';
import { CarbonedJourneySegment, RawJourneySegment } from '../routing/journey-segment';
import {
  CAR_EMISSION_FACTOR_G_PER_KM,
  CarComparison,
  EMISSION_FACTORS_G_PER_KM,
} from './emission-factor';

@Injectable()
export class CarbonService {
  // ponytail: uses the segment's own distanceMeters (its provider's real
  // distance — an OpenRouteService route length for Walk/Bike, Haversine
  // between matched stops for Bus/Tram, see #16) instead of re-deriving a
  // straight-line distance from from/to, so carbon stays consistent with
  // whatever distance actually produced the segment's duration.
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

  carComparison(
    segments: CarbonedJourneySegment[],
    journeyCarbonGrams: number,
  ): CarComparison {
    const totalDistanceKm =
      segments.reduce((sum, segment) => sum + segment.distanceMeters, 0) /
      1000;
    const carCarbonGrams = totalDistanceKm * CAR_EMISSION_FACTOR_G_PER_KM;
    const savedCarbonGrams = carCarbonGrams - journeyCarbonGrams;
    const savedPercent =
      carCarbonGrams === 0 ? 0 : (savedCarbonGrams / carCarbonGrams) * 100;

    return { carCarbonGrams, savedCarbonGrams, savedPercent };
  }
}
