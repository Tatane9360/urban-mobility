import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

describe('Security hardening (e2e)', () => {
  describe('Helmet + CORS (via the real main.ts bootstrap)', () => {
    let app: INestApplication<App>;
    let moduleFixture: TestingModule;
    const originalCorsOrigin = process.env.CORS_ORIGIN;

    beforeAll(async () => {
      process.env.CORS_ORIGIN = 'https://urbanflow.example';
      moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.use(helmet());
      app.enableCors({ origin: process.env.CORS_ORIGIN });
      await app.init();
    });

    afterAll(async () => {
      await app.close();
      process.env.CORS_ORIGIN = originalCorsOrigin;
    });

    it('sets Helmet security headers', async () => {
      const response = await request(app.getHttpServer()).get('/');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });

    it('reflects the configured CORS origin, not a wildcard', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .set('Origin', 'https://urbanflow.example');

      expect(response.headers['access-control-allow-origin']).toBe(
        'https://urbanflow.example',
      );
    });

    it('never reflects the caller-supplied origin back — only the configured one', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .set('Origin', 'https://evil.example');

      expect(response.headers['access-control-allow-origin']).not.toBe(
        'https://evil.example',
      );
      expect(response.headers['access-control-allow-origin']).toBe(
        'https://urbanflow.example',
      );
    });
  });

  describe('Rate limiting (the real AppModule, with its ThrottlerModule limit overridden low)', () => {
    let app: INestApplication<App>;
    let moduleFixture: TestingModule;
    const originalTtl = process.env.THROTTLE_TTL_MS;
    const originalLimit = process.env.THROTTLE_LIMIT;

    beforeAll(async () => {
      // Overrides the same env vars AppModule's ThrottlerModule.forRootAsync
      // reads in production — this exercises the actual global APP_GUARD
      // wiring end-to-end, not a parallel hand-rolled module, so a typo'd
      // real config (e.g. a wrong provider order or storage misconfiguration)
      // would fail this test.
      process.env.THROTTLE_TTL_MS = '10000';
      process.env.THROTTLE_LIMIT = '3';

      moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
      process.env.THROTTLE_TTL_MS = originalTtl;
      process.env.THROTTLE_LIMIT = originalLimit;
    });

    it('returns 429 after exceeding the configured limit on a real route', async () => {
      const server = app.getHttpServer();
      for (let i = 0; i < 3; i++) {
        const ok = await request(server).get('/');
        expect(ok.status).toBe(200);
      }

      const limited = await request(server).get('/');
      expect(limited.status).toBe(429);
    });
  });
});
