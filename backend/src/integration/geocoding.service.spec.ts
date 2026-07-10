import { ServiceUnavailableException } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';

function jsonResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

describe('GeocodingService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps Nominatim results into GeocodeResult candidates', async () => {
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

    const service = new GeocodingService();
    const results = await service.geocode('Comédie');

    expect(results).toEqual([
      {
        displayName: 'Place de la Comédie, Montpellier, France',
        lat: 43.6088,
        lon: 3.8794,
      },
    ]);
  });

  it('returns an empty array when Nominatim has no match', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(jsonResponse([])),
    ) as unknown as typeof fetch;

    const service = new GeocodingService();
    const results = await service.geocode('adresse inexistante xyz');

    expect(results).toEqual([]);
  });

  it('sends a real User-Agent and restricts the search to the Montpellier viewbox', async () => {
    let capturedUrl = '';
    let capturedHeaders: HeadersInit | undefined;
    global.fetch = jest.fn((url: string | URL, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedHeaders = init?.headers;
      return Promise.resolve(jsonResponse([]));
    }) as unknown as typeof fetch;

    const service = new GeocodingService();
    await service.geocode('Comédie');

    expect(capturedUrl).toContain('viewbox=');
    expect(capturedUrl).toContain('bounded=1');
    expect((capturedHeaders as Record<string, string>)['User-Agent']).toMatch(
      /UrbanFlowMobility/,
    );
  });

  it('throws a ServiceUnavailableException when Nominatim responds with a non-ok status', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 503 } as unknown as Response),
    ) as unknown as typeof fetch;

    const service = new GeocodingService();

    await expect(service.geocode('Comédie')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
