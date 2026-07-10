import { Injectable } from '@nestjs/common';
import { haversineDistanceMeters } from '../routing/geo-distance';
import { JourneySegment, RawJourneySegment } from '../routing/journey-segment';
import {
  CAR_EMISSION_FACTOR_G_PER_KM,
  CarComparison,
  EMISSION_FACTORS_G_PER_KM,
} from './emission-factor';

@Injectable()
export class CarbonService {
  // ponytail: segment distance is derived from its own from/to waypoints via
  // Haversine, same straight-line approximation already used throughout
  // routing (see #11) — no OpenRouteService integration in this MVP.
  withCarbon(segment: RawJourneySegment): JourneySegment {
    const distanceKm = haversineDistanceMeters(segment.from, segment.to) / 1000;
    return {
      ...segment,
      carbonGrams: distanceKm * EMISSION_FACTORS_G_PER_KM[segment.mode],
    };
  }

  journeyCarbonGrams(segments: JourneySegment[]): number {
    return segments.reduce((sum, segment) => sum + segment.carbonGrams, 0);
  }

  carComparison(
    segments: JourneySegment[],
    journeyCarbonGrams: number,
  ): CarComparison {
    const totalDistanceKm =
      segments.reduce(
        (sum, segment) =>
          sum + haversineDistanceMeters(segment.from, segment.to),
        0,
      ) / 1000;
    const carCarbonGrams = totalDistanceKm * CAR_EMISSION_FACTOR_G_PER_KM;
    const savedCarbonGrams = carCarbonGrams - journeyCarbonGrams;
    const savedPercent =
      carCarbonGrams === 0 ? 0 : (savedCarbonGrams / carCarbonGrams) * 100;

    return { carCarbonGrams, savedCarbonGrams, savedPercent };
  }
}
