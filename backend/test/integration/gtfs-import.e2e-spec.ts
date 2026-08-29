import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { GtfsAgency } from '../../src/integration/entities/gtfs-agency.entity';
import { GtfsRoute } from '../../src/integration/entities/gtfs-route.entity';
import { GtfsCalendar } from '../../src/integration/entities/gtfs-calendar.entity';
import { GtfsStop } from '../../src/integration/entities/gtfs-stop.entity';
import { GtfsTrip } from '../../src/integration/entities/gtfs-trip.entity';
import { GtfsStopTime } from '../../src/integration/entities/gtfs-stop-time.entity';
import { GtfsImportService } from '../../src/integration/gtfs-import.service';

describe('GtfsImportService (e2e)', () => {
  let moduleFixture: TestingModule;
  let service: GtfsImportService;
  let agencyRepository: Repository<GtfsAgency>;
  let routeRepository: Repository<GtfsRoute>;
  let calendarRepository: Repository<GtfsCalendar>;
  let stopRepository: Repository<GtfsStop>;
  let tripRepository: Repository<GtfsTrip>;
  let stopTimeRepository: Repository<GtfsStopTime>;

  const completeZip = readFileSync(
    join(__dirname, '../fixtures/gtfs-fixture-complete.zip'),
  );
  const malformedZip = readFileSync(
    join(__dirname, '../fixtures/gtfs-fixture-malformed.zip'),
  );

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    service = moduleFixture.get(GtfsImportService);
    agencyRepository = moduleFixture.get(getRepositoryToken(GtfsAgency));
    routeRepository = moduleFixture.get(getRepositoryToken(GtfsRoute));
    calendarRepository = moduleFixture.get(getRepositoryToken(GtfsCalendar));
    stopRepository = moduleFixture.get(getRepositoryToken(GtfsStop));
    tripRepository = moduleFixture.get(getRepositoryToken(GtfsTrip));
    stopTimeRepository = moduleFixture.get(getRepositoryToken(GtfsStopTime));
  });

  afterEach(async () => {
    await agencyRepository.query(
      'TRUNCATE TABLE gtfs_stop_time, gtfs_trip, gtfs_stop, gtfs_calendar, gtfs_route, gtfs_agency CASCADE',
    );
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('imports the full GTFS pipeline, resolving stop_time -> trip -> route -> agency end to end', async () => {
    await service.importFromZip(completeZip);

    expect(await agencyRepository.count()).toBe(1);
    expect(await routeRepository.count()).toBe(2);
    expect(await calendarRepository.count()).toBe(2);
    expect(await stopRepository.count()).toBe(3);
    expect(await tripRepository.count()).toBe(3);
    expect(await stopTimeRepository.count()).toBe(8);

    const stopTimes = await stopTimeRepository.find({
      relations: [
        'trip',
        'trip.route',
        'trip.route.agency',
        'trip.calendar',
        'stop',
      ],
      order: { stopSequence: 'ASC' },
    });
    const firstLeg = stopTimes.find((st) => st.stop.stopId === 'STOP_MOSSON');
    expect(firstLeg?.trip.tripId).toBe('TRIP_L1_1');
    expect(firstLeg?.trip.route.routeId).toBe('L1');
    expect(firstLeg?.trip.route.agency.agencyId).toBe('TAM');
    expect(firstLeg?.trip.calendar.serviceId).toBe('WEEKDAY');
  });

  it('persists stop geometry queryable with a spatial query', async () => {
    await service.importFromZip(completeZip);

    const nearby: Array<{ stopId: string }> = await stopRepository.query(
      `SELECT "stopId" FROM gtfs_stop
       WHERE ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(3.882, 43.614), 4326)::geography, 500)`,
    );
    expect(nearby.map((r) => r.stopId)).toContain('STOP_CORUM');
  });

  it('is idempotent: importing the same zip twice does not create duplicates', async () => {
    await service.importFromZip(completeZip);
    await service.importFromZip(completeZip);

    expect(await agencyRepository.count()).toBe(1);
    expect(await routeRepository.count()).toBe(2);
    expect(await calendarRepository.count()).toBe(2);
    expect(await stopRepository.count()).toBe(3);
    expect(await tripRepository.count()).toBe(3);
    expect(await stopTimeRepository.count()).toBe(8);
  });

  it('fails explicitly and leaves no partial data when a file references an unknown id', async () => {
    await expect(service.importFromZip(malformedZip)).rejects.toThrow(
      /unknown stop_id "STOP_UNKNOWN"/,
    );

    expect(await stopTimeRepository.count()).toBe(0);
    expect(await tripRepository.count()).toBe(0);
    expect(await agencyRepository.count()).toBe(0);
  });
});
