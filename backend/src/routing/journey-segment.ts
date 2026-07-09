import { TransportMode } from '../common/transport-mode.enum';
import { GeoPoint } from './geo-point';

// ponytail: "tracé" per CONTEXT.md's Journey Segment definition is captured
// here as the named waypoints actually used (the matched stop, not just the
// caller's raw search point) — a full route polyline is deferred to #12,
// which is the first ticket that will actually render a map.
export interface JourneyWaypoint extends GeoPoint {
  name: string;
}

export interface JourneySegment {
  mode: TransportMode;
  durationSeconds: number;
  from: JourneyWaypoint;
  to: JourneyWaypoint;
}
