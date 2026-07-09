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
});
