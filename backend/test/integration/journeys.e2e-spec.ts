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
import { GtfsRtService } from '../../src/integration/gtfs-rt.service';
import {
  GtfsRtSnapshot,
  ServiceAlert,
  tripStopKey,
} from '../../src/integration/gtfs-rt.types';
import { TransportMode } from '../../src/common/transport-mode.enum';

describe('Journeys (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let importService: GtfsImportService;
  let agencyRepository: Repository<GtfsAgency>;
  // Stands in for the polled GTFS-RT snapshot — no test reaches
  // data.montpellier3m.fr.
  let snapshot: GtfsRtSnapshot | null = null;

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
    })
      .overrideProvider(GtfsRtService)
      .useValue({
        onModuleInit: () => Promise.resolve(),
        refresh: () => Promise.resolve(),
        getSnapshot: () => snapshot,
        isFresh: (now: Date = new Date()) =>
          snapshot !== null &&
          now.getTime() - snapshot.fetchedAt.getTime() <= 45_000,
        getActiveAlerts: (now: Date = new Date()) =>
          snapshot === null ||
          now.getTime() - snapshot.fetchedAt.getTime() > 45_000
            ? []
            : snapshot.alerts.filter(
                (a) =>
                  (a.activeFrom === null || a.activeFrom <= now) &&
                  (a.activeUntil === null || a.activeUntil >= now),
              ),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    importService = moduleFixture.get(GtfsImportService);
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
      segments: Array<{ mode: string; carbonGrams: number }>;
      durationSeconds: number;
      carbonGrams: number;
      carComparison: { carCarbonGrams: number; savedCarbonGrams: number };
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
    expect(journey.carbonGrams).toBeGreaterThan(0);
    expect(
      journey.segments.every((s) => typeof s.carbonGrams === 'number'),
    ).toBe(true);
    expect(journey.carComparison.carCarbonGrams).toBeGreaterThan(
      journey.carbonGrams,
    );
    expect(journey.carComparison.savedCarbonGrams).toBeGreaterThan(0);
  });

  it('sorts candidate Journeys by carbon when sort=carbon is requested', async () => {
    const response = await request(app.getHttpServer())
      .post('/journeys')
      .send({
        origin: { coordinates: nearMosson },
        destination: { coordinates: nearOdysseum },
        departureTime: '2026-07-10T07:00:00',
        sort: 'carbon',
      });

    expect(response.status).toBe(201);
    const journeys = response.body as Array<{ carbonGrams: number }>;
    const carbonValues = journeys.map((j) => j.carbonGrams);
    expect(carbonValues).toEqual([...carbonValues].sort((a, b) => a - b));
  });

  it('applies a GTFS-RT delay to the Tram segment and reports the journey as not degraded', async () => {
    // Departure at 08:00 delayed 180s, arrival at 08:30 delayed 420s: the
    // rider boards 3 min late and the ride itself is 4 min longer.
    snapshot = {
      vehicles: [],
      delays: new Map([
        [
          tripStopKey('TRIP_L1_1', 'STOP_MOSSON'),
          { tripId: 'TRIP_L1_1', stopId: 'STOP_MOSSON', delaySeconds: 180 },
        ],
        [
          tripStopKey('TRIP_L1_1', 'STOP_ODYSSEUM'),
          { tripId: 'TRIP_L1_1', stopId: 'STOP_ODYSSEUM', delaySeconds: 420 },
        ],
      ]),
      alerts: [],
      fetchedAt: new Date(),
    };

    const response = await request(app.getHttpServer())
      .post('/journeys')
      .send({
        origin: { coordinates: nearMosson },
        destination: { coordinates: nearOdysseum },
        departureTime: '2026-07-10T07:00:00',
      });

    expect(response.status).toBe(201);
    const journeys = response.body as Array<{
      degraded: boolean;
      segments: Array<{
        mode: TransportMode;
        durationSeconds: number;
        delaySeconds?: number;
        realtime?: boolean;
      }>;
    }>;
    const transit = journeys.find((j) =>
      j.segments.some((s) => s.mode === TransportMode.Tram),
    )!;
    expect(transit.degraded).toBe(false);
    const tram = transit.segments.find((s) => s.mode === TransportMode.Tram)!;
    expect(tram).toMatchObject({
      realtime: true,
      delaySeconds: 180,
      durationSeconds: 30 * 60 + (420 - 180),
    });
  });

  it('reports degraded:true and the theoretical schedule when no GTFS-RT snapshot exists', async () => {
    const response = await request(app.getHttpServer())
      .post('/journeys')
      .send({
        origin: { coordinates: nearMosson },
        destination: { coordinates: nearOdysseum },
        departureTime: '2026-07-10T07:00:00',
      });

    expect(response.status).toBe(201);
    const journeys = response.body as Array<{
      degraded: boolean;
      segments: Array<{
        mode: TransportMode;
        durationSeconds: number;
        realtime?: boolean;
      }>;
    }>;
    expect(journeys.every((j) => j.degraded)).toBe(true);
    const tram = journeys
      .flatMap((j) => j.segments)
      .find((s) => s.mode === TransportMode.Tram)!;
    expect(tram.realtime).toBe(false);
    expect(tram.durationSeconds).toBe(30 * 60);
  });

  it('attaches an active ServiceAlert to the Tram segment on the affected route', async () => {
    const alert: ServiceAlert = {
      id: 'ALERT_L1',
      routeIds: ['L1'],
      header: 'Ligne 1 perturbée',
      description: 'Travaux entre Mosson et Odysseum',
      activeFrom: null,
      activeUntil: null,
    };
    snapshot = {
      vehicles: [],
      delays: new Map(),
      alerts: [alert],
      fetchedAt: new Date(),
    };

    const response = await request(app.getHttpServer())
      .post('/journeys')
      .send({
        origin: { coordinates: nearMosson },
        destination: { coordinates: nearOdysseum },
        departureTime: '2026-07-10T07:00:00',
      });

    expect(response.status).toBe(201);
    const journeys = response.body as Array<{
      segments: Array<{
        mode: TransportMode;
        alerts?: Array<{ header: string }>;
      }>;
    }>;
    const tram = journeys
      .flatMap((j) => j.segments)
      .find((s) => s.mode === TransportMode.Tram)!;
    expect(tram.alerts).toEqual([
      { ...alert, activeFrom: null, activeUntil: null },
    ]);
  });

  it('rejects an invalid sort value', async () => {
    const response = await request(app.getHttpServer())
      .post('/journeys')
      .send({
        origin: { coordinates: nearMosson },
        destination: { coordinates: nearOdysseum },
        sort: 'fastest',
      });

    expect(response.status).toBe(400);
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

  it('GET /alerts returns the currently active alerts, without a token', async () => {
    const now = new Date();
    snapshot = {
      vehicles: [],
      delays: new Map(),
      alerts: [
        {
          id: 'CURRENT',
          routeIds: ['L1'],
          header: 'Ligne 1 perturbée',
          description: 'Travaux',
          activeFrom: new Date(now.getTime() - 60_000),
          activeUntil: new Date(now.getTime() + 60_000),
        },
        {
          id: 'EXPIRED',
          routeIds: ['L2'],
          header: 'Terminée',
          description: '',
          activeFrom: new Date(now.getTime() - 7_200_000),
          activeUntil: new Date(now.getTime() - 3_600_000),
        },
      ],
      fetchedAt: now,
    };

    // No Authorization header: a guest must be able to see disruptions.
    const response = await request(app.getHttpServer()).get('/alerts');

    expect(response.status).toBe(200);
    const alerts = response.body as Array<{ id: string; header: string }>;
    expect(alerts.map((a) => a.id)).toEqual(['CURRENT']);
    expect(alerts[0].header).toBe('Ligne 1 perturbée');
  });

  it('GET /alerts returns an empty list when GTFS-RT has no snapshot', async () => {
    const response = await request(app.getHttpServer()).get('/alerts');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
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
