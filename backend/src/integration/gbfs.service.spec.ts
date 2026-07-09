import { ConfigService } from '@nestjs/config';
import { GbfsService } from './gbfs.service';

function mockConfig(): ConfigService {
  return {
    getOrThrow: (key: string) =>
      key === 'GBFS_STATION_INFORMATION_URL'
        ? 'https://example.test/station_information.json'
        : 'https://example.test/station_status.json',
  } as unknown as ConfigService;
}

function jsonResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

describe('GbfsService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps station information and status into a snapshot keyed by station id', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes('information')) {
        return Promise.resolve(
          jsonResponse({
            data: {
              stations: [
                { station_id: '001', name: 'Gare', lat: 43.6, lon: 3.88 },
              ],
            },
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          data: {
            stations: [
              {
                station_id: '001',
                num_bikes_available: 7,
                num_docks_available: 5,
                is_renting: true,
              },
            ],
          },
        }),
      );
    });

    const service = new GbfsService(mockConfig());
    await service.refresh();
    const snapshot = service.getSnapshot();

    expect(snapshot?.stations).toEqual([
      { stationId: '001', name: 'Gare', lat: 43.6, lon: 3.88 },
    ]);
    expect(snapshot?.statusByStationId.get('001')).toEqual({
      stationId: '001',
      bikesAvailable: 7,
      docksAvailable: 5,
      isRenting: true,
    });
  });

  it('keeps the previous snapshot when a refresh fails', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        jsonResponse({
          data: {
            stations: [{ station_id: '001', name: 'Gare', lat: 1, lon: 1 }],
          },
        }),
      ),
    );

    const service = new GbfsService(mockConfig());
    await service.refresh();
    const firstSnapshot = service.getSnapshot();

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500 } as unknown as Response),
    );
    await service.refresh();

    expect(service.getSnapshot()).toBe(firstSnapshot);
  });
});
