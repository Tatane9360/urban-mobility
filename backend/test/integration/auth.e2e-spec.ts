import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { User } from '../../src/auth/entities/user.entity';
import { MobilityProfile } from '../../src/auth/entities/mobility-profile.entity';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let userRepository: Repository<User>;
  let profileRepository: Repository<MobilityProfile>;

  async function registerAndGetToken(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'correct-horse' });
    return (response.body as { accessToken: string }).accessToken;
  }

  async function saveJourney(token: string): Promise<void> {
    await request(app.getHttpServer())
      .post('/journeys/saved')
      .set('Authorization', `Bearer ${token}`)
      .send({
        segments: [
          {
            mode: 'Tram',
            durationSeconds: 600,
            carbonGrams: 11.56,
            from: { name: 'Corum', lat: 43.615, lon: 3.883 },
            to: { name: 'Odysseum', lat: 43.6065, lon: 3.9165 },
          },
        ],
        durationSeconds: 600,
        carbonGrams: 11.56,
        degraded: false,
      })
      .expect(201);
  }

  async function countRows(table: string): Promise<number> {
    // Table names are literals from this spec, never user input.
    const rows = await userRepository.query<Array<{ count: string }>>(
      `SELECT COUNT(*) FROM ${table}`,
    );
    return Number(rows[0].count);
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
    profileRepository = moduleFixture.get(getRepositoryToken(MobilityProfile));
  });

  afterEach(async () => {
    await userRepository.query(
      'TRUNCATE TABLE app_user, mobility_profile CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('creates a User and its Mobility Profile atomically, returning a JWT', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'alice@example.com', password: 'correct-horse' });

      const body = response.body as { accessToken: string };
      expect(response.status).toBe(201);
      expect(typeof body.accessToken).toBe('string');

      expect(await userRepository.count()).toBe(1);
      expect(await profileRepository.count()).toBe(1);

      const user = await userRepository.findOne({
        where: { email: 'alice@example.com' },
        relations: ['mobilityProfile'],
      });
      expect(user?.mobilityProfile).toBeDefined();
    });

    it('rejects a duplicate email and leaves no partial rows', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'bob@example.com', password: 'correct-horse' });

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'bob@example.com', password: 'another-password' });

      expect(response.status).toBe(409);
      expect(await userRepository.count()).toBe(1);
      expect(await profileRepository.count()).toBe(1);
    });

    it('rejects concurrent registrations racing on the same email, leaving no partial rows', async () => {
      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post('/auth/register')
          .send({ email: 'frank@example.com', password: 'correct-horse' }),
        request(app.getHttpServer())
          .post('/auth/register')
          .send({ email: 'frank@example.com', password: 'another-password' }),
      ]);

      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([201, 409]);
      expect(await userRepository.count()).toBe(1);
      expect(await profileRepository.count()).toBe(1);
    });

    it('rejects a missing password and leaves no partial rows', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'carol@example.com' });

      expect(response.status).toBe(400);
      expect(await userRepository.count()).toBe(0);
      expect(await profileRepository.count()).toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    it('returns a JWT for correct credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dave@example.com', password: 'correct-horse' });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'dave@example.com', password: 'correct-horse' });

      const body = response.body as { accessToken: string };
      expect(response.status).toBe(201);
      expect(typeof body.accessToken).toBe('string');
    });

    it('returns 401 for a wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'erin@example.com', password: 'correct-horse' });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'erin@example.com', password: 'wrong-password' });

      expect(response.status).toBe(401);
    });

    it('returns 401 for an unknown email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user for a valid bearer token', async () => {
      const register = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'grace@example.com', password: 'correct-horse' });
      const { accessToken } = register.body as { accessToken: string };

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect((response.body as { email: string }).email).toBe(
        'grace@example.com',
      );
    });

    it('returns 401 without a bearer token', async () => {
      const response = await request(app.getHttpServer()).get('/auth/me');
      expect(response.status).toBe(401);
    });
  });
  describe('DELETE /auth/me', () => {
    it('erases the user and every row of its data, freeing the email', async () => {
      const token = await registerAndGetToken('kate@example.com');
      await saveJourney(token);

      expect(await countRows('mobility_profile')).toBe(1);
      expect(await countRows('saved_journey')).toBe(1);
      expect(await countRows('saved_journey_segment')).toBe(1);

      const response = await request(app.getHttpServer())
        .delete('/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(204);

      // Verified by direct SQL, not just through the API.
      expect(await countRows('app_user')).toBe(0);
      expect(await countRows('mobility_profile')).toBe(0);
      expect(await countRows('saved_journey')).toBe(0);
      expect(await countRows('saved_journey_segment')).toBe(0);

      const meAfter = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(meAfter.status).toBe(401);

      const reRegister = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'kate@example.com', password: 'a-new-password' });
      expect(reRegister.status).toBe(201);
    });

    it('leaves the other users data intact', async () => {
      const aliceToken = await registerAndGetToken('alice-rgpd@example.com');
      const bobToken = await registerAndGetToken('bob-rgpd@example.com');
      await saveJourney(aliceToken);
      await saveJourney(bobToken);

      await request(app.getHttpServer())
        .delete('/auth/me')
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(204);

      expect(await countRows('app_user')).toBe(1);
      expect(await countRows('mobility_profile')).toBe(1);
      expect(await countRows('saved_journey')).toBe(1);
      expect(await countRows('saved_journey_segment')).toBe(1);

      const bobJourneys = await request(app.getHttpServer())
        .get('/journeys/saved')
        .set('Authorization', `Bearer ${bobToken}`);
      expect(bobJourneys.status).toBe(200);
      expect(bobJourneys.body).toHaveLength(1);
    });

    it('returns 401 without a bearer token and deletes nothing', async () => {
      await registerAndGetToken('leo@example.com');

      const response = await request(app.getHttpServer()).delete('/auth/me');

      expect(response.status).toBe(401);
      expect(await countRows('app_user')).toBe(1);
    });
  });

  describe('GET /auth/me/export', () => {
    it('returns email, Mobility Profile and saved Journeys, never the passwordHash', async () => {
      const token = await registerAndGetToken('mia@example.com');
      await request(app.getHttpServer())
        .patch('/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          preferredModes: ['Tram'],
          favoriteAddresses: ['Place de la Comedie, Montpellier'],
        })
        .expect(200);
      await saveJourney(token);

      const response = await request(app.getHttpServer())
        .get('/auth/me/export')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const body = response.body as {
        user: { email: string };
        mobilityProfile: {
          preferredModes: string[];
          favoriteAddresses: string[];
        };
        savedJourneys: Array<{ durationSeconds: number }>;
      };
      expect(body.user.email).toBe('mia@example.com');
      expect(body.mobilityProfile.preferredModes).toEqual(['Tram']);
      expect(body.mobilityProfile.favoriteAddresses).toEqual([
        'Place de la Comedie, Montpellier',
      ]);
      expect(body.savedJourneys).toHaveLength(1);
      expect(body.savedJourneys[0].durationSeconds).toBe(600);

      // The assertion that matters: no password material anywhere in the
      // payload, whatever the nesting depth.
      expect(response.text).not.toContain('passwordHash');
      expect(response.text).not.toContain('$2b$');
      expect(response.text).not.toContain('correct-horse');
    });

    it('returns 401 without a bearer token', async () => {
      const response = await request(app.getHttpServer()).get(
        '/auth/me/export',
      );
      expect(response.status).toBe(401);
    });
  });
});
