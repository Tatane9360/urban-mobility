import { GeoPoint } from './geo-point';
import { RawJourneySegment } from './journey-segment';

export interface MobilityProvider {
  getSegments(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<RawJourneySegment[]>;
}
