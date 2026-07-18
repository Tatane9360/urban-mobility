import { TransportMode } from '../common/transport-mode.enum';
import { CarbonService } from './carbon.service';
import { RawJourneySegment } from '../routing/journey-segment';

// Corum -> Odysseum, ~3.4km straight-line per gtfs-fixture-complete.zip stops.
const tramSegment: RawJourneySegment = {
  mode: TransportMode.Tram,
  durationSeconds: 600,
  distanceMeters: 3400,
  from: { name: 'Corum', lat: 43.6146, lon: 3.8825 },
  to: { name: 'Odysseum', lat: 43.607, lon: 3.917 },
};

const walkSegment: RawJourneySegment = {
  mode: TransportMode.Marche,
  durationSeconds: 120,
  distanceMeters: 150,
  from: { name: '', lat: 43.6146, lon: 3.8825 },
  to: { name: '', lat: 43.615, lon: 3.883 },
};

describe('CarbonService', () => {
  const service = new CarbonService();

  it('computes a positive carbon footprint for a Tram segment', () => {
    const segment = service.withCarbon(tramSegment);

    expect(segment.carbonGrams).toBeGreaterThan(0);
  });

  it('computes zero carbon for a Marche segment', () => {
    const segment = service.withCarbon(walkSegment);

    expect(segment.carbonGrams).toBe(0);
  });

  it('sums segment carbon into a Journey total', () => {
    const segments = [
      service.withCarbon(walkSegment),
      service.withCarbon(tramSegment),
    ];

    const total = service.journeyCarbonGrams(segments);

    expect(total).toBeCloseTo(
      segments[0].carbonGrams + segments[1].carbonGrams,
    );
  });

  it('reports a car comparison with a strictly higher footprint than transit', () => {
    const segments = [service.withCarbon(tramSegment)];
    const journeyCarbonGrams = service.journeyCarbonGrams(segments);

    const comparison = service.carComparison(segments, journeyCarbonGrams);

    expect(comparison.carCarbonGrams).toBeGreaterThan(journeyCarbonGrams);
    expect(comparison.savedCarbonGrams).toBeGreaterThan(0);
    expect(comparison.savedPercent).toBeGreaterThan(0);
    expect(comparison.savedPercent).toBeLessThanOrEqual(100);
  });
});
