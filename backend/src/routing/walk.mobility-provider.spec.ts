import { OpenRouteService } from '../integration/openrouteservice.service';
import { TransportMode } from '../common/transport-mode.enum';
import { WalkMobilityProvider } from './walk.mobility-provider';

function mockOrs(
  route: { distanceMeters: number; durationSeconds: number } | null,
): OpenRouteService {
  return {
    getRoute: jest.fn().mockResolvedValue(route),
  } as unknown as OpenRouteService;
}

describe('WalkMobilityProvider', () => {
  // Corum to Gare Saint-Roch, ~1.1km apart in real life.
  const corum = { lat: 43.6146, lon: 3.8825 };
  const gareSaintRoch = { lat: 43.6051, lon: 3.8799 };

  it('uses the OpenRouteService route distance/duration when available', async () => {
    const provider = new WalkMobilityProvider(
      mockOrs({ distanceMeters: 1200, durationSeconds: 900 }),
    );

    const segments = await provider.getSegments(
      corum,
      gareSaintRoch,
      new Date(),
    );

    expect(segments).toHaveLength(1);
    expect(segments[0].mode).toBe(TransportMode.Marche);
    expect(segments[0].from).toEqual({ name: '', ...corum });
    expect(segments[0].to).toEqual({ name: '', ...gareSaintRoch });
    expect(segments[0].distanceMeters).toBe(1200);
    expect(segments[0].durationSeconds).toBe(900);
  });

  it('falls back to straight-line distance/speed when OpenRouteService is unavailable', async () => {
    const provider = new WalkMobilityProvider(mockOrs(null));

    const segments = await provider.getSegments(
      corum,
      gareSaintRoch,
      new Date(),
    );

    expect(segments).toHaveLength(1);
    expect(segments[0].distanceMeters).toBeGreaterThan(0);
    // ~1.1km at 5km/h is roughly 13 minutes; allow a wide margin.
    expect(segments[0].durationSeconds).toBeGreaterThan(9 * 60);
    expect(segments[0].durationSeconds).toBeLessThan(16 * 60);
  });

  it('returns a near-zero duration for the same origin and destination (fallback path)', async () => {
    const provider = new WalkMobilityProvider(mockOrs(null));
    const point = { lat: 43.6, lon: 3.88 };

    const segments = await provider.getSegments(point, point, new Date());

    expect(segments[0].durationSeconds).toBe(0);
  });
});
