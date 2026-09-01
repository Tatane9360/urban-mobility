import { ConfigService } from '@nestjs/config';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { transit_realtime } from 'gtfs-realtime-bindings';
import { GtfsRtService } from './gtfs-rt.service';
import { tripStopKey } from './gtfs-rt.types';

// The two VehiclePosition vars are required (getOrThrow); TripUpdate/Alert
// fall back to their published defaults, so get() must return the fallback it
// is handed rather than undefined.
function mockConfig(): ConfigService {
  return {
    getOrThrow: (key: string) =>
      key === 'GTFS_RT_URBAIN_VEHICLE_POSITION_URL'
        ? 'https://example.test/Urbain/VehiclePosition.pb'
        : 'https://example.test/Suburbain/VehiclePosition.pb',
    get: (_key: string, fallback: string) => fallback,
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

// Six URLs are polled per refresh (3 feeds x 2 networks). Routes each to its
// own fixture by the filename in the URL; anything unmatched answers empty.
function mockFetchByFeed(feeds: {
  vehiclePosition?: transit_realtime.IFeedEntity[];
  tripUpdate?: transit_realtime.IFeedEntity[];
  alert?: transit_realtime.IFeedEntity[];
}) {
  // Only the Urbain network gets the fixture; Suburbain answers empty, so a
  // count assertion measures the decoder rather than double-counting one
  // fixture served twice.
  return jest.fn((url: string) => {
    const urbain = url.includes('Urbain');
    const entities = !urbain
      ? []
      : url.includes('TripUpdate')
        ? (feeds.tripUpdate ?? [])
        : url.includes('Alert')
          ? (feeds.alert ?? [])
          : (feeds.vehiclePosition ?? []);
    return Promise.resolve(pbResponse(encodeFeed(entities)));
  });
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
    const emptyFeed = encodeFeed([]);

    global.fetch = jest.fn((url: string) => {
      if (!url.includes('VehiclePosition')) {
        return Promise.resolve(pbResponse(emptyFeed));
      }
      return Promise.resolve(
        pbResponse(url.includes('Suburbain') ? suburbainFeed : urbainFeed),
      );
    });

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

  it('indexes TripUpdate stop_time_updates by tripId + stopId', async () => {
    global.fetch = mockFetchByFeed({
      tripUpdate: [
        {
          id: 'TU_1',
          tripUpdate: {
            trip: { tripId: 'TRIP_L1_1', routeId: 'L1' },
            stopTimeUpdate: [
              { stopId: 'MOSSON', departure: { delay: 180 } },
              { stopId: 'ODYSSEUM', arrival: { delay: 240 } },
            ],
          },
        },
      ],
    });

    const service = new GtfsRtService(mockConfig());
    await service.refresh();
    const delays = service.getSnapshot()!.delays;

    expect(delays.get(tripStopKey('TRIP_L1_1', 'MOSSON'))).toEqual({
      tripId: 'TRIP_L1_1',
      stopId: 'MOSSON',
      delaySeconds: 180,
    });
    expect(delays.get(tripStopKey('TRIP_L1_1', 'ODYSSEUM'))?.delaySeconds).toBe(
      240,
    );
    expect(delays.get(tripStopKey('TRIP_L1_1', 'INCONNU'))).toBeUndefined();
  });

  it('falls back to the trip-level delay when a stop_time_update carries none', async () => {
    global.fetch = mockFetchByFeed({
      tripUpdate: [
        {
          id: 'TU_2',
          tripUpdate: {
            trip: { tripId: 'TRIP_L2_1' },
            delay: 90,
            stopTimeUpdate: [{ stopId: 'CORUM' }],
          },
        },
      ],
    });

    const service = new GtfsRtService(mockConfig());
    await service.refresh();

    expect(
      service.getSnapshot()!.delays.get(tripStopKey('TRIP_L2_1', 'CORUM'))
        ?.delaySeconds,
    ).toBe(90);
  });

  it('indexes a TaM run-suffixed tripId under its canonical GTFS trip_id', async () => {
    // TaM publishes `<GTFS trip_id>-<N>`; the static feed only holds
    // `1583496863`, so without stripping the suffix nothing ever matches
    // (measured: 0/38 raw, 36/38 stripped, against the real feed + full GTFS).
    global.fetch = mockFetchByFeed({
      tripUpdate: [
        {
          id: 'TU_SUFFIX',
          tripUpdate: {
            trip: { tripId: '1583496863-4' },
            stopTimeUpdate: [{ stopId: '1234', departure: { delay: 256 } }],
          },
        },
      ],
    });

    const service = new GtfsRtService(mockConfig());
    await service.refresh();
    const delays = service.getSnapshot()!.delays;

    expect(delays.get(tripStopKey('1583496863', '1234'))?.delaySeconds).toBe(
      256,
    );
    // The raw form stays indexed too, so a producer that ever publishes the
    // canonical id keeps matching.
    expect(delays.get(tripStopKey('1583496863-4', '1234'))?.delaySeconds).toBe(
      256,
    );
  });

  it('leaves a tripId without a run suffix untouched', async () => {
    global.fetch = mockFetchByFeed({
      tripUpdate: [
        {
          id: 'TU_PLAIN',
          tripUpdate: {
            trip: { tripId: '1583496284' },
            stopTimeUpdate: [{ stopId: '1234', departure: { delay: -21 } }],
          },
        },
      ],
    });

    const service = new GtfsRtService(mockConfig());
    await service.refresh();
    const delays = service.getSnapshot()!.delays;

    expect(delays.get(tripStopKey('1583496284', '1234'))?.delaySeconds).toBe(
      -21,
    );
    // Nothing was stripped, so exactly one key exists for this trip.
    expect(delays.size).toBe(1);
  });

  it('keeps an id whose trailing digits are not a run counter matchable', async () => {
    // `4-2-T221-0-014300` is a different shape entirely — a blind strip would
    // mangle it to `4-2-T221-0` and lose the only form that could ever match.
    global.fetch = mockFetchByFeed({
      tripUpdate: [
        {
          id: 'TU_ODD',
          tripUpdate: {
            trip: { tripId: '4-2-T221-0-014300' },
            stopTimeUpdate: [{ stopId: '1234', departure: { delay: 301 } }],
          },
        },
      ],
    });

    const service = new GtfsRtService(mockConfig());
    await service.refresh();
    const delays = service.getSnapshot()!.delays;

    expect(
      delays.get(tripStopKey('4-2-T221-0-014300', '1234'))?.delaySeconds,
    ).toBe(301);
  });

  it('decodes a ServiceAlert with its active period, routeIds and FR text', async () => {
    global.fetch = mockFetchByFeed({
      alert: [
        {
          id: 'ALERT_1',
          alert: {
            activePeriod: [{ start: 1783620000, end: 1783630000 }],
            informedEntity: [{ routeId: 'L1' }, { routeId: 'L4' }],
            headerText: {
              translation: [
                { language: 'en', text: 'Line 1 disrupted' },
                { language: 'fr', text: 'Ligne 1 perturbée' },
              ],
            },
            descriptionText: {
              translation: [
                { language: 'fr', text: 'Travaux entre Corum et Odysseum' },
              ],
            },
          },
        },
      ],
    });

    const service = new GtfsRtService(mockConfig());
    await service.refreshAlerts();
    await service.refresh();
    const alert = service.getSnapshot()!.alerts[0];

    expect(alert).toEqual({
      id: 'ALERT_1',
      routeIds: ['L1', 'L4'],
      header: 'Ligne 1 perturbée',
      description: 'Travaux entre Corum et Odysseum',
      activeFrom: new Date(1783620000 * 1000),
      activeUntil: new Date(1783630000 * 1000),
    });
  });

  it('getActiveAlerts excludes an alert whose period has ended', async () => {
    const now = new Date(1783625000 * 1000);
    global.fetch = mockFetchByFeed({
      alert: [
        {
          id: 'CURRENT',
          alert: {
            activePeriod: [{ start: 1783620000, end: 1783630000 }],
            informedEntity: [{ routeId: 'L1' }],
            headerText: { translation: [{ language: 'fr', text: 'En cours' }] },
          },
        },
        {
          id: 'EXPIRED',
          alert: {
            activePeriod: [{ start: 1783600000, end: 1783610000 }],
            informedEntity: [{ routeId: 'L2' }],
            headerText: { translation: [{ language: 'fr', text: 'Terminée' }] },
          },
        },
        {
          id: 'FUTURE',
          alert: {
            activePeriod: [{ start: 1783700000, end: 1783710000 }],
            informedEntity: [{ routeId: 'L3' }],
            headerText: { translation: [{ language: 'fr', text: 'À venir' }] },
          },
        },
        {
          id: 'UNBOUNDED',
          alert: {
            informedEntity: [{ routeId: 'L5' }],
            headerText: {
              translation: [{ language: 'fr', text: 'Sans période' }],
            },
          },
        },
      ],
    });

    const service = new GtfsRtService(mockConfig());
    await service.refreshAlerts();
    await service.refresh();

    expect(service.getActiveAlerts(now).map((a) => a.id)).toEqual([
      'CURRENT',
      'UNBOUNDED',
    ]);
  });

  it('reports a snapshot older than the staleness window as not fresh', async () => {
    global.fetch = mockFetchByFeed({});
    const service = new GtfsRtService(mockConfig());
    await service.refresh();
    const fetchedAt = service.getSnapshot()!.fetchedAt;

    expect(service.isFresh(new Date(fetchedAt.getTime() + 10_000))).toBe(true);
    // 30s: the PRD freshness KPI, which the threshold is pinned to rather than
    // derived from the poll interval.
    expect(service.isFresh(new Date(fetchedAt.getTime() + 29_000))).toBe(true);
    expect(service.isFresh(new Date(fetchedAt.getTime() + 31_000))).toBe(false);
    expect(service.isFresh(new Date(fetchedAt.getTime() + 600_000))).toBe(
      false,
    );
    // A stale snapshot serves no alerts either — an expired disruption banner
    // is misinformation, not degraded service.
    expect(
      service.getActiveAlerts(new Date(fetchedAt.getTime() + 600_000)),
    ).toEqual([]);
  });

  it('does not refetch the Alert feed on the 15s refresh, and keeps serving the cached alerts', async () => {
    // Polling all six feeds at 15s made data.montpellier3m.fr answer 429.
    // Alerts are on their own 5-minute interval; refresh() must reuse them.
    global.fetch = mockFetchByFeed({
      alert: [
        {
          id: 'ALERT_1',
          alert: {
            informedEntity: [{ routeId: 'L1' }],
            headerText: { translation: [{ language: 'fr', text: 'Travaux' }] },
          },
        },
      ],
    });
    const service = new GtfsRtService(mockConfig());
    await service.refreshAlerts();

    const fetchMock = mockFetchByFeed({});
    global.fetch = fetchMock;
    await service.refresh();

    // Four URLs per refresh (VehiclePosition + TripUpdate, x2 networks), not six.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('Alert')),
    ).toBe(false);
    // The alert survives a refresh that never fetched it.
    expect(service.getActiveAlerts().map((a) => a.id)).toEqual(['ALERT_1']);
  });

  it('keeps the previous alerts when the Alert feed fails', async () => {
    global.fetch = mockFetchByFeed({
      alert: [
        {
          id: 'ALERT_1',
          alert: {
            informedEntity: [{ routeId: 'L1' }],
            headerText: { translation: [{ language: 'fr', text: 'Travaux' }] },
          },
        },
      ],
    });
    const service = new GtfsRtService(mockConfig());
    await service.refreshAlerts();
    await service.refresh();

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 429 } as unknown as Response),
    );
    await service.refreshAlerts();

    expect(service.getActiveAlerts().map((a) => a.id)).toEqual(['ALERT_1']);
  });

  it('reports no snapshot at all as not fresh', () => {
    expect(new GtfsRtService(mockConfig()).isFresh()).toBe(false);
  });

  it('keeps the previous snapshot when a refresh fails', async () => {
    global.fetch = mockFetchByFeed({
      vehiclePosition: [
        { id: '1', vehicle: { position: { latitude: 1, longitude: 1 } } },
      ],
    });

    const service = new GtfsRtService(mockConfig());
    await service.refresh();
    const firstSnapshot = service.getSnapshot();

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500 } as unknown as Response),
    );
    await service.refresh();

    expect(service.getSnapshot()).toBe(firstSnapshot);
  });

  it('keeps the previous snapshot when only the TripUpdate feed is broken', async () => {
    global.fetch = mockFetchByFeed({
      tripUpdate: [
        {
          id: 'TU_1',
          tripUpdate: {
            trip: { tripId: 'TRIP_L1_1' },
            stopTimeUpdate: [{ stopId: 'MOSSON', departure: { delay: 180 } }],
          },
        },
      ],
    });
    const service = new GtfsRtService(mockConfig());
    await service.refresh();
    const firstSnapshot = service.getSnapshot();
    expect(firstSnapshot!.delays.size).toBe(1);

    // VehiclePosition and Alert still answer fine; only TripUpdate 500s. The
    // snapshot must not be half-rewritten with an empty delay index.
    global.fetch = jest.fn((url: string) =>
      url.includes('TripUpdate')
        ? Promise.resolve({ ok: false, status: 500 } as unknown as Response)
        : Promise.resolve(pbResponse(encodeFeed([]))),
    );
    await service.refresh();

    expect(service.getSnapshot()).toBe(firstSnapshot);
  });

  // TaM throttles the two networks independently, so one 429 must not discard
  // the sibling feed that answered 200.
  it('keeps the feed that answered when its sibling is throttled', async () => {
    global.fetch = jest.fn((url: string) =>
      url.includes('Suburbain/VehiclePosition')
        ? Promise.resolve({ ok: false, status: 429 } as unknown as Response)
        : Promise.resolve(
            pbResponse(
              encodeFeed([
                {
                  id: 'VP_1',
                  vehicle: {
                    vehicle: { id: 'BUS_1' },
                    position: { latitude: 43.6, longitude: 3.87 },
                  },
                },
              ]),
            ),
          ),
    );

    const service = new GtfsRtService(mockConfig());
    await service.refresh();

    // The Urbain vehicles survived the Suburbain 429.
    expect(service.getSnapshot()!.vehicles.length).toBeGreaterThan(0);
  });

  it('keeps the previous snapshot when a feed returns corrupted bytes', async () => {
    global.fetch = mockFetchByFeed({ alert: [] });
    const service = new GtfsRtService(mockConfig());
    await service.refresh();
    const firstSnapshot = service.getSnapshot();

    const garbage = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    global.fetch = jest.fn(() => Promise.resolve(pbResponse(garbage)));
    await service.refresh();

    expect(service.getSnapshot()).toBe(firstSnapshot);
  });
});
