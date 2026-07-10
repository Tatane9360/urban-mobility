import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { GtfsAgency } from '../../src/integration/entities/gtfs-agency.entity';
import { GtfsImportService } from '../../src/integration/gtfs-import.service';
import { TransportMode } from '../../src/common/transport-mode.enum';

describe('Journeys (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let importService: GtfsImportService;
  let agencyRepository: Repository<GtfsAgency>;

  const completeZip = readFileSync(
    join(__dirname, '../fixtures/gtfs-fixture-complete.zip'),
  );

  // Mosson and Odysseum stops per gtfs-fixture-complete.zip, offset slightly
  // from the real stop coordinates so the planner must add bridging Marche
  // segments (see bus-tram.mobility-provider.e2e-spec.ts for the exact stops).
  const nearMosson = { lat: 43.6225, lon: 3.8035 };
  const nearOdysseum = { lat: 43.6075, lon: 3.9175 };
  const farAway = { lat: 48.8566, lon: 2.3522 }; // Paris — outside the TaM perimeter

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    importService = moduleFixture.get(GtfsImportService);
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
    await app.close();
  });

  it('returns a multimodal Journey (Marche + Tram + Marche) for a real TaM origin/destination', async () => {
    const response = await request(app.getHttpServer())
      .post('/journeys')
      .send({
        origin: { coordinates: nearMosson },
        destination: { coordinates: nearOdysseum },
        departureTime: '2026-07-10T07:00:00',
      });

    expect(response.status).toBe(201);
    const journeys = response.body as Array<{
      segments: Array<{ mode: string }>;
      durationSeconds: number;
      degraded: boolean;
    }>;
    expect(journeys.length).toBeGreaterThanOrEqual(1);
    const [journey] = journeys;
    expect(journey.segments.map((s) => s.mode)).toEqual([
      TransportMode.Marche,
      TransportMode.Tram,
      TransportMode.Marche,
    ]);
    expect(journey.durationSeconds).toBeGreaterThan(0);
    expect(typeof journey.degraded).toBe('boolean');
  });

  it('falls back to a direct Marche Journey when the search is outside the TaM perimeter', async () => {
    const response = await request(app.getHttpServer())
      .post('/journeys')
      .send({
        origin: { coordinates: farAway },
        destination: { coordinates: nearOdysseum },
      });

    expect(response.status).toBe(201);
    const journeys = response.body as Array<{
      segments: Array<{ mode: string }>;
    }>;
    expect(journeys).toHaveLength(1);
    expect(journeys[0].segments.map((s) => s.mode)).toEqual([
      TransportMode.Marche,
    ]);
  });

  it('rejects a journey point with neither coordinates nor address', async () => {
    const response = await request(app.getHttpServer())
      .post('/journeys')
      .send({
        origin: {},
        destination: { coordinates: nearOdysseum },
      });

    expect(response.status).toBe(400);
  });
});
