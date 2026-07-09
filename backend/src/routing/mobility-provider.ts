import { GeoPoint } from './geo-point';
import { JourneySegment } from './journey-segment';

export interface MobilityProvider {
  getSegments(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<JourneySegment[]>;
}
