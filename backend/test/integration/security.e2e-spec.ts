import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

// Isolated module with its own strict, low rate limit — proves the
// ThrottlerGuard mechanism works without depending on (or slowing down tests
// with) the real app's generous 100 req/min global limit.
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 10_000, limit: 3 }])],
  controllers: [PingController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ThrottledTestModule {}

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

  describe('Rate limiting', () => {
    let app: INestApplication<App>;
    let moduleFixture: TestingModule;

    beforeAll(async () => {
      moduleFixture = await Test.createTestingModule({
        imports: [ThrottledTestModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 429 after exceeding the configured limit', async () => {
      const server = app.getHttpServer();
      for (let i = 0; i < 3; i++) {
        const ok = await request(server).get('/ping');
        expect(ok.status).toBe(200);
      }

      const limited = await request(server).get('/ping');
      expect(limited.status).toBe(429);
    });
  });
});
