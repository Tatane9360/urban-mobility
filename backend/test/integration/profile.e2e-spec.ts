import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { User } from '../../src/auth/entities/user.entity';

describe('Profile (e2e)', () => {
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
      'TRUNCATE TABLE app_user, mobility_profile CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /profile', () => {
    it('returns the empty Mobility Profile just after registration', async () => {
      const token = await registerAndGetToken('alice@example.com');

      const response = await request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        preferredModes: [],
        favoriteAddresses: [],
        pmrAccessibility: false,
      });
    });

    it('returns 401 without a bearer token', async () => {
      const response = await request(app.getHttpServer()).get('/profile');
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /profile', () => {
    it('updates preferred modes, favorite addresses and PMR flag', async () => {
      const token = await registerAndGetToken('bob@example.com');

      const response = await request(app.getHttpServer())
        .patch('/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          preferredModes: ['Bus', 'Vélo'],
          favoriteAddresses: [{ label: 'Maison', address: '1 rue de la Loge, Montpellier' }],
          pmrAccessibility: true,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        preferredModes: ['Bus', 'Vélo'],
        favoriteAddresses: [{ label: 'Maison', address: '1 rue de la Loge, Montpellier' }],
        pmrAccessibility: true,
      });

      const getResponse = await request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.body).toEqual(response.body);
    });

    it('rejects a favorite address missing both a label and an address', async () => {
      const token = await registerAndGetToken('frank@example.com');

      const response = await request(app.getHttpServer())
        .patch('/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ favoriteAddresses: [{}] });

      expect(response.status).toBe(400);
    });

    it('accepts a legacy plain-string favorite address alongside a labelled one, upgrading it in place', async () => {
      // Accounts that saved favorites before the {label, address} format
      // shipped still carry plain strings in the jsonb column — a PATCH that
      // merely edits another favorite must not 400 on those legacy entries.
      const token = await registerAndGetToken('gina@example.com');

      const response = await request(app.getHttpServer())
        .patch('/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          favoriteAddresses: [
            'Gare de Montpellier Saint-Roch, Montpellier',
            { label: 'Maison', address: 'Rue de la Loge, Montpellier' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.favoriteAddresses).toEqual([
        { label: '', address: 'Gare de Montpellier Saint-Roch, Montpellier' },
        { label: 'Maison', address: 'Rue de la Loge, Montpellier' },
      ]);
    });

    it('rejects a preferred mode outside the Transport Mode domain enum', async () => {
      const token = await registerAndGetToken('carol@example.com');

      const response = await request(app.getHttpServer())
        .patch('/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ preferredModes: ['Trottinette'] });

      expect(response.status).toBe(400);
    });

    it('returns 401 without a bearer token', async () => {
      const response = await request(app.getHttpServer())
        .patch('/profile')
        .send({ pmrAccessibility: true });
      expect(response.status).toBe(401);
    });

    it("does not let a user read or modify another user's profile", async () => {
      const daveToken = await registerAndGetToken('dave@example.com');
      const erinToken = await registerAndGetToken('erin@example.com');

      await request(app.getHttpServer())
        .patch('/profile')
        .set('Authorization', `Bearer ${daveToken}`)
        .send({ favoriteAddresses: [{ label: 'Maison', address: "Dave's home" }] });

      const erinProfile = await request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', `Bearer ${erinToken}`);
      expect(erinProfile.body).toEqual({
        preferredModes: [],
        favoriteAddresses: [],
        pmrAccessibility: false,
      });

      await request(app.getHttpServer())
        .patch('/profile')
        .set('Authorization', `Bearer ${erinToken}`)
        .send({ favoriteAddresses: [{ label: 'Maison', address: "Erin's home" }] });

      const daveProfile = await request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', `Bearer ${daveToken}`);
      expect(daveProfile.body).toEqual({
        preferredModes: [],
        favoriteAddresses: [{ label: 'Maison', address: "Dave's home" }],
        pmrAccessibility: false,
      });
    });
  });
});
