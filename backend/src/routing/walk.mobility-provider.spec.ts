import { TransportMode } from '../common/transport-mode.enum';
import { WalkMobilityProvider } from './walk.mobility-provider';

describe('WalkMobilityProvider', () => {
  const provider = new WalkMobilityProvider();

  it('returns a Marche segment with a duration derived from straight-line distance', async () => {
    // Corum to Gare Saint-Roch, ~1.1km apart in real life.
    const corum = { lat: 43.6146, lon: 3.8825 };
    const gareSaintRoch = { lat: 43.6051, lon: 3.8799 };

    const segments = await provider.getSegments(
      corum,
      gareSaintRoch,
      new Date(),
    );

    expect(segments).toHaveLength(1);
    expect(segments[0].mode).toBe(TransportMode.Marche);
    expect(segments[0].from).toEqual({ name: '', ...corum });
    expect(segments[0].to).toEqual({ name: '', ...gareSaintRoch });
    // ~1.1km at 5km/h is roughly 13 minutes; allow a wide margin.
    expect(segments[0].durationSeconds).toBeGreaterThan(9 * 60);
    expect(segments[0].durationSeconds).toBeLessThan(16 * 60);
  });

  it('returns a near-zero duration for the same origin and destination', async () => {
    const point = { lat: 43.6, lon: 3.88 };

    const segments = await provider.getSegments(point, point, new Date());

    expect(segments[0].durationSeconds).toBe(0);
  });
});
