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

function geojsonResponse(
  summary: { distance: number; duration: number },
  coordinates: Array<[number, number]> = [],
  steps: Array<{ instruction: string; distance: number; duration: number; type: number; way_points: [number, number] }> = [],
) {
  return jsonResponse({
    features: [
      {
        geometry: { coordinates },
        properties: { summary, segments: [{ steps }] },
      },
    ],
  });
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
      Promise.resolve(geojsonResponse({ distance: 3816.1, duration: 773.5 })),
    ) as unknown as typeof fetch;

    const service = new OpenRouteService(mockConfig());
    const route = await service.getRoute(corum, odysseum, 'cycling-regular');

    expect(route).toEqual({ distanceMeters: 3816.1, durationSeconds: 773.5, steps: [], geometry: [] });
  });

  it('parses turn-by-turn steps with their maneuver location from the route geometry', async () => {
    const coordinates: Array<[number, number]> = [
      [3.8825, 43.6146],
      [3.89, 43.615],
      [3.9, 43.616],
      [3.917, 43.607],
    ];
    global.fetch = jest.fn(() =>
      Promise.resolve(
        geojsonResponse({ distance: 100, duration: 60 }, coordinates, [
          { instruction: 'Tournez à droite', distance: 50, duration: 30, type: 1, way_points: [0, 1] },
          { instruction: 'Continuez tout droit', distance: 50, duration: 30, type: 11, way_points: [1, 3] },
        ]),
      ),
    ) as unknown as typeof fetch;

    const service = new OpenRouteService(mockConfig());
    const route = await service.getRoute(corum, odysseum, 'foot-walking');

    expect(route?.steps).toEqual([
      {
        instruction: 'Tournez à droite',
        distanceMeters: 50,
        durationSeconds: 30,
        type: 1,
        location: { lat: 43.615, lon: 3.89 },
      },
      {
        instruction: 'Continuez tout droit',
        distanceMeters: 50,
        durationSeconds: 30,
        type: 11,
        location: { lat: 43.607, lon: 3.917 },
      },
    ]);
  });

  it('returns the full route geometry so the map can draw the real tracé', async () => {
    const coordinates: Array<[number, number]> = [
      [3.8825, 43.6146],
      [3.89, 43.615],
      [3.917, 43.607],
    ];
    global.fetch = jest.fn(() =>
      Promise.resolve(geojsonResponse({ distance: 100, duration: 60 }, coordinates)),
    ) as unknown as typeof fetch;

    const service = new OpenRouteService(mockConfig());
    const route = await service.getRoute(corum, odysseum, 'foot-walking');

    expect(route?.geometry).toEqual([
      { lat: 43.6146, lon: 3.8825 },
      { lat: 43.615, lon: 3.89 },
      { lat: 43.607, lon: 3.917 },
    ]);
  });

  it('sends the API key and coordinates in [lon, lat] order', async () => {
    let capturedHeaders: HeadersInit | undefined;
    let capturedBody = '';
    global.fetch = jest.fn((_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers;
      capturedBody = init?.body as string;
      return Promise.resolve(geojsonResponse({ distance: 1, duration: 1 }));
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
      instructions: true,
      language: 'fr',
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

  it('returns null when the response has no features', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(jsonResponse({ features: [] })),
    ) as unknown as typeof fetch;

    const service = new OpenRouteService(mockConfig());
    const route = await service.getRoute(corum, odysseum, 'foot-walking');

    expect(route).toBeNull();
  });
});
