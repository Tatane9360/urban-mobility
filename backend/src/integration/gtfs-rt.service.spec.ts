import { ConfigService } from '@nestjs/config';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { transit_realtime } from 'gtfs-realtime-bindings';
import { GtfsRtService } from './gtfs-rt.service';

function mockConfig(): ConfigService {
  return {
    getOrThrow: (key: string) =>
      key === 'GTFS_RT_URBAIN_VEHICLE_POSITION_URL'
        ? 'https://example.test/urbain.pb'
        : 'https://example.test/suburbain.pb',
  } as unknown as ConfigService;
}

function encodeFeed(entities: transit_realtime.IFeedEntity[]): Uint8Array {
  const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;
  const message = FeedMessage.create({
    header: { gtfsRealtimeVersion: '2.0' },
    entity: entities,
  });
  return FeedMessage.encode(message).finish();
}

function pbResponse(bytes: Uint8Array): Response {
  const copy = Uint8Array.from(bytes).buffer;
  return {
    ok: true,
    arrayBuffer: () => Promise.resolve(copy),
  } as unknown as Response;
}

describe('GtfsRtService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('decodes and merges vehicle positions from both networks', async () => {
    const urbainFeed = encodeFeed([
      {
        id: '176',
        vehicle: {
          trip: { tripId: 'TRIP_1', routeId: '19' },
          position: {
            latitude: 43.6,
            longitude: 3.88,
            bearing: 296,
            speed: 9.7,
          },
          vehicle: { id: '176' },
          timestamp: 1783628488,
        },
      },
    ]);
    const suburbainFeed = encodeFeed([
      {
        id: '42',
        vehicle: {
          position: { latitude: 43.7, longitude: 3.9 },
          timestamp: 1783628500,
        },
      },
    ]);

    global.fetch = jest.fn((url: string) =>
      Promise.resolve(
        pbResponse(url.includes('suburbain') ? suburbainFeed : urbainFeed),
      ),
    );

    const service = new GtfsRtService(mockConfig());
    await service.refresh();
    const snapshot = service.getSnapshot();

    expect(snapshot?.vehicles).toHaveLength(2);
    const first = snapshot?.vehicles.find((v) => v.vehicleId === '176');
    expect(first).toMatchObject({
      vehicleId: '176',
      tripId: 'TRIP_1',
      routeId: '19',
      bearing: 296,
      timestamp: new Date(1783628488 * 1000),
    });
    expect(first?.lat).toBeCloseTo(43.6, 5);
    expect(first?.lon).toBeCloseTo(3.88, 5);
    expect(first?.speed).toBeCloseTo(9.7, 5);

    const second = snapshot?.vehicles.find((v) => v.vehicleId === '42');
    expect(second).toMatchObject({
      vehicleId: '42',
      tripId: null,
      routeId: null,
      // protobuf leaves unset numeric fields at their zero default, not
      // undefined, so a stationary/unset vehicle reads bearing/speed as 0.
      bearing: 0,
      speed: 0,
      timestamp: new Date(1783628500 * 1000),
    });
    expect(second?.lat).toBeCloseTo(43.7, 5);
    expect(second?.lon).toBeCloseTo(3.9, 5);
  });

  it('keeps the previous snapshot when a refresh fails', async () => {
    const feed = encodeFeed([
      {
        id: '1',
        vehicle: { position: { latitude: 1, longitude: 1 } },
      },
    ]);
    global.fetch = jest.fn(() => Promise.resolve(pbResponse(feed)));

    const service = new GtfsRtService(mockConfig());
    await service.refresh();
    const firstSnapshot = service.getSnapshot();

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500 } as unknown as Response),
    );
    await service.refresh();

    expect(service.getSnapshot()).toBe(firstSnapshot);
  });
});
