import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { GtfsAgency } from '../../src/integration/entities/gtfs-agency.entity';
import { GtfsImportService } from '../../src/integration/gtfs-import.service';
import { BusTramMobilityProvider } from '../../src/routing/bus-tram.mobility-provider';
import { GtfsRtService } from '../../src/integration/gtfs-rt.service';
import {
  GtfsRtSnapshot,
  TripStopDelay,
  tripStopKey,
} from '../../src/integration/gtfs-rt.types';
import { TransportMode } from '../../src/common/transport-mode.enum';

describe('BusTramMobilityProvider (e2e)', () => {
  let moduleFixture: TestingModule;
  let importService: GtfsImportService;
  let provider: BusTramMobilityProvider;
  let agencyRepository: Repository<GtfsAgency>;
  // The provider reads GTFS-RT through the real service; this stub stands in
  // for the polled snapshot so no test ever touches data.montpellier3m.fr.
  let snapshot: GtfsRtSnapshot | null = null;

  function stubSnapshot(delays: TripStopDelay[]): void {
    snapshot = {
      vehicles: [],
      delays: new Map(delays.map((d) => [tripStopKey(d.tripId, d.stopId), d])),
      alerts: [],
      fetchedAt: new Date(),
    };
  }

  const completeZip = readFileSync(
    join(__dirname, '../fixtures/gtfs-fixture-complete.zip'),
  );

  // Mosson -> Corum -> Odysseum, TRIP_L1_1, route L1 (route_type 0 = Tram),
  // service WEEKDAY (monday..friday), per gtfs-fixture-complete.zip.
  // The same fixture carries TRIP_L2_1 (route L2, service WEEKEND):
  // Corum 09:00 -> Odysseum 09:20 — the counterpart used to prove the
  // calendar filter selects a service rather than merely excluding one.
  const mosson = { lat: 43.622, lon: 3.803 };
  const corum = { lat: 43.614, lon: 3.882 };
  const odysseum = { lat: 43.607, lon: 3.917 };

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GtfsRtService)
      .useValue({
        onModuleInit: () => Promise.resolve(),
        refresh: () => Promise.resolve(),
        getSnapshot: () => snapshot,
        // Mirrors the real 45s window; every stubbed snapshot is fetched
        // "now", so this only ever flips on a deliberately aged one.
        isFresh: (now: Date = new Date()) =>
          snapshot !== null &&
          now.getTime() - snapshot.fetchedAt.getTime() <= 45_000,
        getActiveAlerts: () => [],
      })
      .compile();

    importService = moduleFixture.get(GtfsImportService);
    provider = moduleFixture.get(BusTramMobilityProvider);
    agencyRepository = moduleFixture.get(getRepositoryToken(GtfsAgency));
  });

  beforeEach(async () => {
    snapshot = null;
    await importService.importFromZip(completeZip);
  });

  afterEach(async () => {
    await agencyRepository.query(
      'TRUNCATE TABLE gtfs_stop_time, gtfs_trip, gtfs_stop, gtfs_calendar, gtfs_route, gtfs_agency CASCADE',
    );
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('finds a Tram segment from Mosson to Odysseum departing after the requested time', async () => {
    const departureTime = new Date('2026-07-10T07:00:00');

    const segments = await provider.getSegments(
      mosson,
      odysseum,
      departureTime,
    );

    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(segments[0]).toMatchObject({
      mode: TransportMode.Tram,
      durationSeconds: 30 * 60,
      from: { name: 'Mosson' },
      to: { name: 'Odysseum' },
    });
  });

  it('finds a shorter Tram segment between two intermediate stops (Mosson to Corum)', async () => {
    const departureTime = new Date('2026-07-10T07:00:00');

    const segments = await provider.getSegments(mosson, corum, departureTime);

    expect(segments[0]).toMatchObject({
      mode: TransportMode.Tram,
      durationSeconds: 15 * 60,
      from: { name: 'Mosson' },
      to: { name: 'Corum' },
    });
  });

  it('does not return a trip whose departure is before the requested time', async () => {
    // TRIP_L1_1 departs Mosson at 08:00; searching from 09:00 excludes it.
    const departureTime = new Date('2026-07-10T09:00:00');

    const segments = await provider.getSegments(
      mosson,
      odysseum,
      departureTime,
    );

    expect(segments).toEqual([]);
  });

  it('returns no segments when no stop is near the requested origin', async () => {
    const farAway = { lat: 48.8566, lon: 2.3522 };
    const departureTime = new Date('2026-07-10T07:00:00');

    const segments = await provider.getSegments(
      farAway,
      odysseum,
      departureTime,
    );

    expect(segments).toEqual([]);
  });

  it('does not return a WEEKDAY-only trip on a Sunday', async () => {
    // 2026-07-12 is a Sunday. TRIP_L1_1 runs service WEEKDAY (monday..friday),
    // so proposing it would send the user to a stop no tram serves that day.
    const departureTime = new Date('2026-07-12T07:00:00');

    const segments = await provider.getSegments(
      mosson,
      odysseum,
      departureTime,
    );

    expect(segments).toEqual([]);
  });

  it('does not return a WEEKEND-only trip on a weekday', async () => {
    // The mirror case: TRIP_L2_1 departs Corum at 09:00 on service WEEKEND
    // (saturday/sunday). 2026-07-10 is a Friday, so it must not be proposed —
    // otherwise the LIMIT 1 could hand back a phantom trip while a real
    // weekday one exists.
    const departureTime = new Date('2026-07-10T08:30:00');

    const segments = await provider.getSegments(corum, odysseum, departureTime);

    expect(segments).toEqual([]);
  });

  it('returns a WEEKEND trip on a Saturday, when its service does run', async () => {
    // 2026-07-11 is a Saturday — TRIP_L2_1's own service day. Proves the
    // calendar filter selects the right service instead of just excluding
    // everything: the same search on the Friday returns nothing (asserted
    // above), this one finds the trip.
    const departureTime = new Date('2026-07-11T08:00:00');

    const segments = await provider.getSegments(corum, odysseum, departureTime);

    expect(segments[0]).toMatchObject({
      mode: TransportMode.Tram,
      tripHeadsign: 'Saint-Jean-de-Vedas',
      from: { name: 'Corum' },
    });
  });

  it('applies a GTFS-RT arrival delay to the matched stop_time, stretching durationSeconds', async () => {
    // TRIP_L1_1: Mosson 08:00 -> Odysseum 08:30 (1800s theoretical). A +180s
    // delay at Odysseum only means the tram left on time and arrives late, so
    // the ride itself is 180s longer.
    stubSnapshot([
      { tripId: 'TRIP_L1_1', stopId: 'STOP_ODYSSEUM', delaySeconds: 180 },
    ]);
    const departureTime = new Date('2026-07-10T07:00:00');

    const segments = await provider.getSegments(
      mosson,
      odysseum,
      departureTime,
    );

    expect(segments[0]).toMatchObject({
      durationSeconds: 30 * 60 + 180,
      realtime: true,
      // Boarding is unaffected — the delay is at the far end.
      delaySeconds: 0,
    });
  });

  it('reports a boarding delay on delaySeconds and carries it to the arrival', async () => {
    // A +180s delay published only at the boarding stop: the whole trip
    // shifts 3 minutes later, so the ride length is unchanged but the rider
    // waits 3 extra minutes.
    stubSnapshot([
      { tripId: 'TRIP_L1_1', stopId: 'STOP_MOSSON', delaySeconds: 180 },
    ]);
    const departureTime = new Date('2026-07-10T07:00:00');

    const segments = await provider.getSegments(
      mosson,
      odysseum,
      departureTime,
    );

    expect(segments[0]).toMatchObject({
      durationSeconds: 30 * 60,
      realtime: true,
      delaySeconds: 180,
    });
  });

  it('falls back to the theoretical schedule with realtime:false when the trip is absent from the feed', async () => {
    stubSnapshot([
      { tripId: 'TRIP_INCONNU', stopId: 'STOP_MOSSON', delaySeconds: 600 },
    ]);
    const departureTime = new Date('2026-07-10T07:00:00');

    const segments = await provider.getSegments(
      mosson,
      odysseum,
      departureTime,
    );

    expect(segments[0]).toMatchObject({
      durationSeconds: 30 * 60,
      realtime: false,
      delaySeconds: 0,
    });
  });

  it('ignores a delay carried by a stale snapshot', async () => {
    // Same +180s as above, but the snapshot is 10 minutes old — past the
    // staleness window, so it must not shift the schedule at all.
    stubSnapshot([
      { tripId: 'TRIP_L1_1', stopId: 'STOP_ODYSSEUM', delaySeconds: 180 },
    ]);
    snapshot!.fetchedAt = new Date(Date.now() - 10 * 60_000);
    const departureTime = new Date('2026-07-10T07:00:00');

    const segments = await provider.getSegments(
      mosson,
      odysseum,
      departureTime,
    );

    expect(segments[0]).toMatchObject({
      durationSeconds: 30 * 60,
      realtime: false,
    });
  });

  it('exposes the GTFS routeId alongside the human route_short_name', async () => {
    // The alert-matching key: informedEntity carries route_id ("L1"), the UI
    // shows route_short_name ("1"). Both must survive to the segment.
    const departureTime = new Date('2026-07-10T07:00:00');

    const segments = await provider.getSegments(
      mosson,
      odysseum,
      departureTime,
    );

    expect(segments[0]).toMatchObject({ routeId: 'L1', routeShortName: '1' });
  });

  it('does not return a trip whose service period has not started yet', async () => {
    // Both fixture services run 20260101..20261231. A search dated outside
    // that window must return nothing even on a matching day of the week —
    // 2025-07-10 is also a Thursday.
    const departureTime = new Date('2025-07-10T07:00:00');

    const segments = await provider.getSegments(
      mosson,
      odysseum,
      departureTime,
    );

    expect(segments).toEqual([]);
  });
});
