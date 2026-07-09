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
  // per gtfs-fixture-complete.zip.
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
      from: mosson,
      to: odysseum,
    });
  });

  it('finds a shorter Tram segment between two intermediate stops (Mosson to Corum)', async () => {
    const departureTime = new Date('2026-07-10T07:00:00');

    const segments = await provider.getSegments(mosson, corum, departureTime);

    expect(segments[0]).toMatchObject({
      mode: TransportMode.Tram,
      durationSeconds: 15 * 60,
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
});
