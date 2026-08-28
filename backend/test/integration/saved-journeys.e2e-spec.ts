import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { User } from '../../src/auth/entities/user.entity';
import { TransportMode } from '../../src/common/transport-mode.enum';

interface SavedJourneyResponse {
  id: string;
  savedAt: string;
  durationSeconds: number;
  carbonGrams: number;
  degraded: boolean;
  segments: Array<{ mode: TransportMode }>;
}

function sampleJourneyPayload() {
  return {
    segments: [
      {
        mode: TransportMode.Marche,
        durationSeconds: 120,
        carbonGrams: 0,
        from: { name: '', lat: 43.6146, lon: 3.8825 },
        to: { name: 'Corum', lat: 43.615, lon: 3.883 },
      },
      {
        mode: TransportMode.Tram,
        durationSeconds: 600,
        carbonGrams: 11.56,
        from: { name: 'Corum', lat: 43.615, lon: 3.883 },
        to: { name: 'Odysseum', lat: 43.6065, lon: 3.9165 },
      },
    ],
    durationSeconds: 720,
    carbonGrams: 11.56,
    degraded: false,
  };
}

describe('SavedJourneys (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let userRepository: Repository<User>;

  async function registerAndGetToken(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'correct-horse' });
    return (response.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
  });

  afterEach(async () => {
    await userRepository.query(
      'TRUNCATE TABLE app_user, mobility_profile, saved_journey, saved_journey_segment CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /journeys/saved', () => {
    it('persists a Journey with all its segments for the authenticated user', async () => {
      const token = await registerAndGetToken('alice@example.com');

      const response = await request(app.getHttpServer())
        .post('/journeys/saved')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleJourneyPayload());

      const body = response.body as SavedJourneyResponse;
      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        durationSeconds: 720,
        carbonGrams: 11.56,
        degraded: false,
      });
      expect(body.segments).toHaveLength(2);
      expect(body.segments[0].mode).toBe(TransportMode.Marche);
      expect(body.segments[1].mode).toBe(TransportMode.Tram);
      expect(body.id).toBeDefined();
      expect(body.savedAt).toBeDefined();
    });

    it('returns 401 without a bearer token and saves nothing', async () => {
      const response = await request(app.getHttpServer())
        .post('/journeys/saved')
        .send(sampleJourneyPayload());

      expect(response.status).toBe(401);

      const count = await userRepository.query<Array<{ count: string }>>(
        'SELECT COUNT(*) FROM saved_journey',
      );
      expect(Number(count[0].count)).toBe(0);
    });
  });

  describe('GET /journeys/saved', () => {
    it('lists only the current user Journeys, most recent first', async () => {
      const token = await registerAndGetToken('bob@example.com');
      await request(app.getHttpServer())
        .post('/journeys/saved')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleJourneyPayload());
      await request(app.getHttpServer())
        .post('/journeys/saved')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...sampleJourneyPayload(), durationSeconds: 300 });

      const response = await request(app.getHttpServer())
        .get('/journeys/saved')
        .set('Authorization', `Bearer ${token}`);

      const body = response.body as SavedJourneyResponse[];
      expect(response.status).toBe(200);
      expect(body).toHaveLength(2);
      expect(body[0].durationSeconds).toBe(300);
    });

    it('returns 401 without a bearer token', async () => {
      const response = await request(app.getHttpServer()).get(
        '/journeys/saved',
      );
      expect(response.status).toBe(401);
    });

    it("does not leak another user's saved Journeys", async () => {
      const daveToken = await registerAndGetToken('dave@example.com');
      const erinToken = await registerAndGetToken('erin@example.com');

      await request(app.getHttpServer())
        .post('/journeys/saved')
        .set('Authorization', `Bearer ${daveToken}`)
        .send(sampleJourneyPayload());

      const erinJourneys = await request(app.getHttpServer())
        .get('/journeys/saved')
        .set('Authorization', `Bearer ${erinToken}`);

      expect(erinJourneys.body).toEqual([]);
    });
  });
  describe('DELETE /journeys/saved/:id', () => {
    it('deletes the current user own Journey, which then disappears from the list', async () => {
      const token = await registerAndGetToken('gina@example.com');
      const saved = await request(app.getHttpServer())
        .post('/journeys/saved')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleJourneyPayload());
      const { id } = saved.body as SavedJourneyResponse;

      const response = await request(app.getHttpServer())
        .delete(`/journeys/saved/${id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);

      const list = await request(app.getHttpServer())
        .get('/journeys/saved')
        .set('Authorization', `Bearer ${token}`);
      expect(list.body).toEqual([]);
    });

    it('returns 404 when deleting another user Journey, and leaves it untouched', async () => {
      const aliceToken = await registerAndGetToken('alice-del@example.com');
      const bobToken = await registerAndGetToken('bob-del@example.com');

      const bobJourney = await request(app.getHttpServer())
        .post('/journeys/saved')
        .set('Authorization', `Bearer ${bobToken}`)
        .send(sampleJourneyPayload());
      const { id } = bobJourney.body as SavedJourneyResponse;

      const response = await request(app.getHttpServer())
        .delete(`/journeys/saved/${id}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      // 404, never 403: a 403 would confirm the Journey exists.
      expect(response.status).toBe(404);

      const bobList = await request(app.getHttpServer())
        .get('/journeys/saved')
        .set('Authorization', `Bearer ${bobToken}`);
      expect(bobList.body).toHaveLength(1);
      expect((bobList.body as SavedJourneyResponse[])[0].id).toBe(id);
    });

    it('returns 404 for an unknown id', async () => {
      const token = await registerAndGetToken('hank@example.com');

      const response = await request(app.getHttpServer())
        .delete('/journeys/saved/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it('returns 401 without a bearer token and deletes nothing', async () => {
      const token = await registerAndGetToken('ivan@example.com');
      const saved = await request(app.getHttpServer())
        .post('/journeys/saved')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleJourneyPayload());
      const { id } = saved.body as SavedJourneyResponse;

      const response = await request(app.getHttpServer()).delete(
        `/journeys/saved/${id}`,
      );

      expect(response.status).toBe(401);

      const count = await userRepository.query<Array<{ count: string }>>(
        'SELECT COUNT(*) FROM saved_journey',
      );
      expect(Number(count[0].count)).toBe(1);
    });

    it('cascades to saved_journey_segment, leaving no orphan rows', async () => {
      const token = await registerAndGetToken('judy@example.com');
      const saved = await request(app.getHttpServer())
        .post('/journeys/saved')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleJourneyPayload());
      const { id } = saved.body as SavedJourneyResponse;

      const before = await userRepository.query<Array<{ count: string }>>(
        'SELECT COUNT(*) FROM saved_journey_segment',
      );
      expect(Number(before[0].count)).toBe(2);

      await request(app.getHttpServer())
        .delete(`/journeys/saved/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const after = await userRepository.query<Array<{ count: string }>>(
        'SELECT COUNT(*) FROM saved_journey_segment',
      );
      expect(Number(after[0].count)).toBe(0);
    });
  });

  // #5 - cumulative carbon footprint. Distances are chosen so the expected
  // numbers are exact: 1 km Marche (0 g) + 4 km Tram (4 * 3.4 = 13.6 g).
  // Car baseline for the same 5 km: 5 * 193 = 965 g.
  describe('GET /journeys/saved/stats (cumulative carbon footprint)', () => {
    const WALK_METERS = 1000;
    const TRAM_METERS = 4000;
    const TRAM_CARBON = 13.6;
    const CAR_GRAMS_FOR_5KM = 965;

    interface StatsResponse {
      journeyCount: number;
      durationSeconds: number;
      distanceMeters: number;
      carbonGrams: number;
      carCarbonGrams: number;
      savedCarbonGrams: number;
      savedPercent: number;
      byMode: Array<{
        mode: TransportMode;
        journeySegments: number;
        durationSeconds: number;
        distanceMeters: number;
        carbonGrams: number;
      }>;
    }

    function measuredJourneyPayload() {
      return {
        segments: [
          {
            mode: TransportMode.Marche,
            durationSeconds: 120,
            distanceMeters: WALK_METERS,
            carbonGrams: 0,
            from: { name: '', lat: 43.6146, lon: 3.8825 },
            to: { name: 'Corum', lat: 43.615, lon: 3.883 },
          },
          {
            mode: TransportMode.Tram,
            durationSeconds: 600,
            distanceMeters: TRAM_METERS,
            carbonGrams: TRAM_CARBON,
            from: { name: 'Corum', lat: 43.615, lon: 3.883 },
            to: { name: 'Odysseum', lat: 43.6065, lon: 3.9165 },
          },
        ],
        durationSeconds: 720,
        carbonGrams: TRAM_CARBON,
        degraded: false,
      };
    }

    async function save(token: string) {
      await request(app.getHttpServer())
        .post('/journeys/saved')
        .set('Authorization', `Bearer ${token}`)
        .send(measuredJourneyPayload())
        .expect(201);
    }

    function getStats(token: string, query = '') {
      return request(app.getHttpServer())
        .get(`/journeys/saved/stats${query}`)
        .set('Authorization', `Bearer ${token}`);
    }

    it('aggregates the current user Journeys against the car baseline', async () => {
      const token = await registerAndGetToken('stats-solo@example.com');
      await save(token);
      await save(token);

      const response = await getStats(token);
      const body = response.body as StatsResponse;

      expect(response.status).toBe(200);
      expect(body.journeyCount).toBe(2);
      expect(body.durationSeconds).toBe(1440);
      expect(body.distanceMeters).toBe(2 * (WALK_METERS + TRAM_METERS));
      expect(body.carbonGrams).toBeCloseTo(2 * TRAM_CARBON, 5);
      expect(body.carCarbonGrams).toBeCloseTo(2 * CAR_GRAMS_FOR_5KM, 5);
      expect(body.savedCarbonGrams).toBeCloseTo(
        2 * (CAR_GRAMS_FOR_5KM - TRAM_CARBON),
        5,
      );
      expect(body.savedPercent).toBeGreaterThan(98);
      expect(body.savedPercent).toBeLessThan(100);
    });

    // The test that matters most: one user totals must never absorb another's.
    it("never counts another user's saved Journeys in the totals", async () => {
      const mineToken = await registerAndGetToken('stats-mine@example.com');
      const theirsToken = await registerAndGetToken('stats-theirs@example.com');

      await save(mineToken);
      await save(theirsToken);
      await save(theirsToken);
      await save(theirsToken);

      const mine = (await getStats(mineToken)).body as StatsResponse;
      const theirs = (await getStats(theirsToken)).body as StatsResponse;

      expect(mine.journeyCount).toBe(1);
      expect(mine.distanceMeters).toBe(WALK_METERS + TRAM_METERS);
      expect(mine.carbonGrams).toBeCloseTo(TRAM_CARBON, 5);

      expect(theirs.journeyCount).toBe(3);
      expect(theirs.distanceMeters).toBe(3 * (WALK_METERS + TRAM_METERS));
      expect(theirs.carbonGrams).toBeCloseTo(3 * TRAM_CARBON, 5);
    });

    it('returns zeroed totals, with no NaN in savedPercent, when nothing is saved', async () => {
      const token = await registerAndGetToken('stats-empty@example.com');

      const response = await getStats(token);
      const body = response.body as StatsResponse;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        journeyCount: 0,
        durationSeconds: 0,
        distanceMeters: 0,
        carbonGrams: 0,
        carCarbonGrams: 0,
        savedCarbonGrams: 0,
        savedPercent: 0,
      });
      expect(body.byMode).toEqual([]);
      // JSON serialises NaN to null, which would slip past a loose check --
      // assert finiteness explicitly.
      expect(Number.isFinite(body.savedPercent)).toBe(true);
    });

    it('aggregates only the Journeys saved inside the ?from=&to= period', async () => {
      const token = await registerAndGetToken('stats-period@example.com');
      await save(token);
      await save(token);

      // savedAt defaults to now(); backdate one row out of the window.
      const rows = await userRepository.query<Array<{ id: string }>>(
        'SELECT id FROM saved_journey ORDER BY id LIMIT 1',
      );
      await userRepository.query(
        'UPDATE saved_journey SET "savedAt" = $2 WHERE id = $1',
        [rows[0].id, '2020-01-15T10:00:00.000Z'],
      );

      const recent = (await getStats(token, '?from=2021-01-01T00:00:00.000Z'))
        .body as StatsResponse;
      expect(recent.journeyCount).toBe(1);
      expect(recent.distanceMeters).toBe(WALK_METERS + TRAM_METERS);

      const older = (
        await getStats(
          token,
          '?from=2020-01-01T00:00:00.000Z&to=2020-02-01T00:00:00.000Z',
        )
      ).body as StatsResponse;
      expect(older.journeyCount).toBe(1);
      expect(older.distanceMeters).toBe(WALK_METERS + TRAM_METERS);

      const none = (
        await getStats(
          token,
          '?from=2019-01-01T00:00:00.000Z&to=2019-02-01T00:00:00.000Z',
        )
      ).body as StatsResponse;
      expect(none.journeyCount).toBe(0);
      expect(none.carbonGrams).toBe(0);
      expect(none.savedPercent).toBe(0);

      const all = (await getStats(token)).body as StatsResponse;
      expect(all.journeyCount).toBe(2);
    });

    it('breaks the total down by mode, and the parts sum back to the whole', async () => {
      const token = await registerAndGetToken('stats-modes@example.com');
      await save(token);
      await save(token);

      const body = (await getStats(token)).body as StatsResponse;

      expect(body.byMode.map((entry) => entry.mode).sort()).toEqual(
        [TransportMode.Marche, TransportMode.Tram].sort(),
      );

      const tram = body.byMode.find(
        (entry) => entry.mode === TransportMode.Tram,
      );
      expect(tram).toMatchObject({
        journeySegments: 2,
        distanceMeters: 2 * TRAM_METERS,
      });
      expect(tram?.carbonGrams).toBeCloseTo(2 * TRAM_CARBON, 5);

      const walk = body.byMode.find(
        (entry) => entry.mode === TransportMode.Marche,
      );
      expect(walk).toMatchObject({ journeySegments: 2, carbonGrams: 0 });

      const summed = body.byMode.reduce(
        (totals, entry) => ({
          carbonGrams: totals.carbonGrams + entry.carbonGrams,
          durationSeconds: totals.durationSeconds + entry.durationSeconds,
          distanceMeters: totals.distanceMeters + entry.distanceMeters,
        }),
        { carbonGrams: 0, durationSeconds: 0, distanceMeters: 0 },
      );
      expect(summed.carbonGrams).toBeCloseTo(body.carbonGrams, 5);
      expect(summed.durationSeconds).toBe(body.durationSeconds);
      expect(summed.distanceMeters).toBe(body.distanceMeters);
    });

    it('returns 401 without a bearer token', async () => {
      const response = await request(app.getHttpServer()).get(
        '/journeys/saved/stats',
      );
      expect(response.status).toBe(401);
    });
  });
});
