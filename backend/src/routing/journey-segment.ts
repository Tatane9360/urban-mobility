import { TransportMode } from '../common/transport-mode.enum';
import { GeoPoint } from './geo-point';

export interface JourneySegment {
  mode: TransportMode;
  durationSeconds: number;
  from: GeoPoint;
  to: GeoPoint;
}
