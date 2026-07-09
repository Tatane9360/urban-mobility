import { GbfsService } from '../integration/gbfs.service';
import { GbfsSnapshot } from '../integration/gbfs.types';
import { TransportMode } from '../common/transport-mode.enum';
import { BikeMobilityProvider } from './bike.mobility-provider';

// Corum, real Vélomagg station coordinates from endpoints.md's fixture area.
const corum = { lat: 43.6146, lon: 3.8825 };
const odysseum = { lat: 43.607, lon: 3.917 };

function mockGbfsService(snapshot: GbfsSnapshot | null): GbfsService {
  return { getSnapshot: () => snapshot } as unknown as GbfsService;
}

describe('BikeMobilityProvider', () => {
  it('returns a Vélo segment when a nearby station has bikes available', async () => {
    const snapshot: GbfsSnapshot = {
      stations: [
        { stationId: '001', name: 'Corum', lat: 43.6147, lon: 3.8826 },
      ],
      statusByStationId: new Map([
        [
          '001',
          {
            stationId: '001',
            bikesAvailable: 3,
            docksAvailable: 5,
            isRenting: true,
          },
        ],
      ]),
      fetchedAt: new Date(),
    };
    const provider = new BikeMobilityProvider(mockGbfsService(snapshot));

    const segments = await provider.getSegments(corum, odysseum, new Date());

    expect(segments).toHaveLength(1);
    expect(segments[0].mode).toBe(TransportMode.Velo);
    expect(segments[0].from).toEqual({ name: 'Corum', ...corum });
    expect(segments[0].durationSeconds).toBeGreaterThan(0);
  });

  it('returns no segment when the nearby station has no bikes available', async () => {
    const snapshot: GbfsSnapshot = {
      stations: [
        { stationId: '001', name: 'Corum', lat: 43.6147, lon: 3.8826 },
      ],
      statusByStationId: new Map([
        [
          '001',
          {
            stationId: '001',
            bikesAvailable: 0,
            docksAvailable: 8,
            isRenting: true,
          },
        ],
      ]),
      fetchedAt: new Date(),
    };
    const provider = new BikeMobilityProvider(mockGbfsService(snapshot));

    const segments = await provider.getSegments(corum, odysseum, new Date());

    expect(segments).toEqual([]);
  });

  it('returns no segment when no station is near the origin', async () => {
    const snapshot: GbfsSnapshot = {
      stations: [
        { stationId: '999', name: 'Far away', lat: 48.8566, lon: 2.3522 },
      ],
      statusByStationId: new Map([
        [
          '999',
          {
            stationId: '999',
            bikesAvailable: 5,
            docksAvailable: 5,
            isRenting: true,
          },
        ],
      ]),
      fetchedAt: new Date(),
    };
    const provider = new BikeMobilityProvider(mockGbfsService(snapshot));

    const segments = await provider.getSegments(corum, odysseum, new Date());

    expect(segments).toEqual([]);
  });

  it('returns no segment when the GBFS snapshot is not yet available', async () => {
    const provider = new BikeMobilityProvider(mockGbfsService(null));

    const segments = await provider.getSegments(corum, odysseum, new Date());

    expect(segments).toEqual([]);
  });
});
