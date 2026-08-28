import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { GtfsAgency } from '../../src/integration/entities/gtfs-agency.entity';
import { GtfsImportService } from '../../src/integration/gtfs-import.service';
import { BusTramMobilityProvider } from '../../src/routing/bus-tram.mobility-provider';
import { TransportMode } from '../../src/common/transport-mode.enum';

describe('BusTramMobilityProvider (e2e)', () => {
  let moduleFixture: TestingModule;
  let importService: GtfsImportService;
  let provider: BusTramMobilityProvider;
  let agencyRepository: Repository<GtfsAgency>;

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
    }).compile();

    importService = moduleFixture.get(GtfsImportService);
    provider = moduleFixture.get(BusTramMobilityProvider);
    agencyRepository = moduleFixture.get(getRepositoryToken(GtfsAgency));
  });

  beforeEach(async () => {
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
