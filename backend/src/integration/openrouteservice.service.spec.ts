import { ConfigService } from '@nestjs/config';
import { OpenRouteService } from './openrouteservice.service';

function mockConfig(): ConfigService {
  return {
    getOrThrow: () => 'test-api-key',
  } as unknown as ConfigService;
}

function jsonResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

const corum = { lat: 43.6146, lon: 3.8825 };
const odysseum = { lat: 43.607, lon: 3.917 };

describe('OpenRouteService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns distance/duration parsed from the ORS directions response', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        jsonResponse({
          routes: [{ summary: { distance: 3816.1, duration: 773.5 } }],
        }),
      ),
    ) as unknown as typeof fetch;

    const service = new OpenRouteService(mockConfig());
    const route = await service.getRoute(corum, odysseum, 'cycling-regular');

    expect(route).toEqual({ distanceMeters: 3816.1, durationSeconds: 773.5 });
  });

  it('sends the API key and coordinates in [lon, lat] order', async () => {
    let capturedHeaders: HeadersInit | undefined;
    let capturedBody = '';
    global.fetch = jest.fn((_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers;
      capturedBody = init?.body as string;
      return Promise.resolve(
        jsonResponse({ routes: [{ summary: { distance: 1, duration: 1 } }] }),
      );
    }) as unknown as typeof fetch;

    const service = new OpenRouteService(mockConfig());
    await service.getRoute(corum, odysseum, 'foot-walking');

    expect((capturedHeaders as Record<string, string>).Authorization).toBe(
      'test-api-key',
    );
    expect(JSON.parse(capturedBody)).toEqual({
      coordinates: [
        [corum.lon, corum.lat],
        [odysseum.lon, odysseum.lat],
      ],
    });
  });

  it('returns null when ORS responds with a non-ok status', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 404 } as unknown as Response),
    ) as unknown as typeof fetch;

    const service = new OpenRouteService(mockConfig());
    const route = await service.getRoute(corum, odysseum, 'foot-walking');

    expect(route).toBeNull();
  });

  it('returns null when the fetch call throws', async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('network down')),
    ) as unknown as typeof fetch;

    const service = new OpenRouteService(mockConfig());
    const route = await service.getRoute(corum, odysseum, 'foot-walking');

    expect(route).toBeNull();
  });

  it('returns null when the response has no routes', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(jsonResponse({ routes: [] })),
    ) as unknown as typeof fetch;

    const service = new OpenRouteService(mockConfig());
    const route = await service.getRoute(corum, odysseum, 'foot-walking');

    expect(route).toBeNull();
  });
});
