import { GbfsService } from '../integration/gbfs.service';
import { GbfsSnapshot } from '../integration/gbfs.types';
import { OpenRouteService } from '../integration/openrouteservice.service';
import { TransportMode } from '../common/transport-mode.enum';
import { BikeMobilityProvider } from './bike.mobility-provider';

// Corum and Odysseum, real Vélomagg-area coordinates from endpoints.md.
const corum = { lat: 43.6146, lon: 3.8825 };
const odysseum = { lat: 43.607, lon: 3.917 };

function mockGbfsService(snapshot: GbfsSnapshot | null): GbfsService {
  return { getSnapshot: () => snapshot } as unknown as GbfsService;
}

function mockOrs(route: { distanceMeters: number; durationSeconds: number } | null): OpenRouteService {
  return { getRoute: jest.fn().mockResolvedValue(route) } as unknown as OpenRouteService;
}

function snapshotWithStations(
  stations: Array<{
    stationId: string;
    name: string;
    lat: number;
    lon: number;
    bikesAvailable: number;
    docksAvailable: number;
    isRenting: boolean;
  }>,
): GbfsSnapshot {
  return {
    stations: stations.map((s) => ({
      stationId: s.stationId,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
    })),
    statusByStationId: new Map(
      stations.map((s) => [
        s.stationId,
        {
          stationId: s.stationId,
          bikesAvailable: s.bikesAvailable,
          docksAvailable: s.docksAvailable,
          isRenting: s.isRenting,
        },
      ]),
    ),
    fetchedAt: new Date(),
  };
}

describe('BikeMobilityProvider', () => {
  it('returns a Vélo segment between a pickup station (bikes) and a drop-off station (free dock)', async () => {
    const snapshot = snapshotWithStations([
      {
        stationId: '001',
        name: 'Corum',
        lat: 43.6147,
        lon: 3.8826,
        bikesAvailable: 3,
        docksAvailable: 5,
        isRenting: true,
      },
      {
        stationId: '002',
        name: 'Odysseum',
        lat: 43.6071,
        lon: 3.9171,
        bikesAvailable: 1,
        docksAvailable: 4,
        isRenting: true,
      },
    ]);
    const provider = new BikeMobilityProvider(
      mockGbfsService(snapshot),
      mockOrs({ distanceMeters: 3800, durationSeconds: 770 }),
    );

    const segments = await provider.getSegments(corum, odysseum, new Date());

    expect(segments).toHaveLength(1);
    expect(segments[0].mode).toBe(TransportMode.Velo);
    expect(segments[0].from).toEqual({
      name: 'Corum',
      lat: 43.6147,
      lon: 3.8826,
    });
    expect(segments[0].to).toEqual({
      name: 'Odysseum',
      lat: 43.6071,
      lon: 3.9171,
    });
    expect(segments[0].distanceMeters).toBe(3800);
    expect(segments[0].durationSeconds).toBe(770);
  });

  it('falls back to straight-line distance/speed when OpenRouteService is unavailable', async () => {
    const snapshot = snapshotWithStations([
      {
        stationId: '001',
        name: 'Corum',
        lat: 43.6147,
        lon: 3.8826,
        bikesAvailable: 3,
        docksAvailable: 5,
        isRenting: true,
      },
      {
        stationId: '002',
        name: 'Odysseum',
        lat: 43.6071,
        lon: 3.9171,
        bikesAvailable: 1,
        docksAvailable: 4,
        isRenting: true,
      },
    ]);
    const provider = new BikeMobilityProvider(
      mockGbfsService(snapshot),
      mockOrs(null),
    );

    const segments = await provider.getSegments(corum, odysseum, new Date());

    expect(segments).toHaveLength(1);
    expect(segments[0].distanceMeters).toBeGreaterThan(0);
    expect(segments[0].durationSeconds).toBeGreaterThan(0);
  });

  it('returns no segment when the pickup station has no bikes available', async () => {
    const snapshot = snapshotWithStations([
      {
        stationId: '001',
        name: 'Corum',
        lat: 43.6147,
        lon: 3.8826,
        bikesAvailable: 0,
        docksAvailable: 8,
        isRenting: true,
      },
      {
        stationId: '002',
        name: 'Odysseum',
        lat: 43.6071,
        lon: 3.9171,
        bikesAvailable: 1,
        docksAvailable: 4,
        isRenting: true,
      },
    ]);
    const provider = new BikeMobilityProvider(
      mockGbfsService(snapshot),
      mockOrs(null),
    );

    const segments = await provider.getSegments(corum, odysseum, new Date());

    expect(segments).toEqual([]);
  });

  it('returns no segment when the drop-off station has no free dock', async () => {
    const snapshot = snapshotWithStations([
      {
        stationId: '001',
        name: 'Corum',
        lat: 43.6147,
        lon: 3.8826,
        bikesAvailable: 3,
        docksAvailable: 5,
        isRenting: true,
      },
      {
        stationId: '002',
        name: 'Odysseum',
        lat: 43.6071,
        lon: 3.9171,
        bikesAvailable: 1,
        docksAvailable: 0,
        isRenting: true,
      },
    ]);
    const provider = new BikeMobilityProvider(
      mockGbfsService(snapshot),
      mockOrs(null),
    );

    const segments = await provider.getSegments(corum, odysseum, new Date());

    expect(segments).toEqual([]);
  });

  it('returns no segment when no station is near the origin', async () => {
    const snapshot = snapshotWithStations([
      {
        stationId: '999',
        name: 'Far away',
        lat: 48.8566,
        lon: 2.3522,
        bikesAvailable: 5,
        docksAvailable: 5,
        isRenting: true,
      },
    ]);
    const provider = new BikeMobilityProvider(
      mockGbfsService(snapshot),
      mockOrs(null),
    );

    const segments = await provider.getSegments(corum, odysseum, new Date());

    expect(segments).toEqual([]);
  });

  it('returns no segment when the GBFS snapshot is not yet available', async () => {
    const provider = new BikeMobilityProvider(
      mockGbfsService(null),
      mockOrs(null),
    );

    const segments = await provider.getSegments(corum, odysseum, new Date());

    expect(segments).toEqual([]);
  });
});
