import { TransportMode } from '../common/transport-mode.enum';
import { GeoPoint } from './geo-point';
import { RawJourneySegment } from './journey-segment';

export interface MobilityProvider {
  // The Transport Modes this provider can produce. Declared rather than
  // inferred so the planner can skip a provider nobody asked for without
  // knowing which class it is — Bus/Tram covers two, the others one each.
  readonly modes: readonly TransportMode[];

  // The core legs for one mode: stop-to-stop, station-to-station, or the whole
  // walk. Bridging Marche segments are NOT included — proposeJourneys adds
  // them. Kept as the provider's own seam because both the per-provider specs
  // and the Bus/Tram e2e drive it directly.
  getSegments(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<RawJourneySegment[]>;

  // The candidate Journeys this provider proposes, each an ordered segment
  // list. Where the composition lives: Bus/Tram returns one candidate per
  // departure, Vélo returns its segments as a single ride, Marche returns the
  // one direct walk. The planner used to encode all three shapes itself.
  //
  // `wanted` filters by Transport Mode, applied here rather than by the
  // caller: only the provider knows whether its own segments are separable by
  // mode (Bus/Tram is, having produced both from one query).
  proposeJourneys(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
    wanted: (mode: TransportMode) => boolean,
  ): Promise<RawJourneySegment[][]>;
}
