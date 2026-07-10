import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

function jsonResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

describe('Geocode (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /geocode?q=... returns matching candidates', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        jsonResponse([
          {
            display_name: 'Place de la Comédie, Montpellier, France',
            lat: '43.6088',
            lon: '3.8794',
          },
        ]),
      ),
    ) as unknown as typeof fetch;

    const response = await request(app.getHttpServer()).get(
      '/geocode?q=Comédie',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        displayName: 'Place de la Comédie, Montpellier, France',
        lat: 43.6088,
        lon: 3.8794,
      },
    ]);
  });

  it('GET /geocode?q=... returns an empty array when nothing matches', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(jsonResponse([])),
    ) as unknown as typeof fetch;

    const response = await request(app.getHttpServer()).get(
      '/geocode?q=adresse-totalement-inexistante',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('GET /geocode without q rejects with 400', async () => {
    const response = await request(app.getHttpServer()).get('/geocode');

    expect(response.status).toBe(400);
  });

  it('GET /geocode?q=... returns 503 when Nominatim is unavailable', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 503 } as unknown as Response),
    ) as unknown as typeof fetch;

    const response = await request(app.getHttpServer()).get(
      '/geocode?q=Comédie',
    );

    expect(response.status).toBe(503);
  });
});
