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
});
