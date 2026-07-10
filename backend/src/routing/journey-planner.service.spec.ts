import { BadRequestException } from '@nestjs/common';
import { TransportMode } from '../common/transport-mode.enum';
import { GtfsRtSnapshot } from '../integration/gtfs-rt.types';
import { JourneyPlannerService } from './journey-planner.service';
import { JourneySegment } from './journey-segment';

const origin = { lat: 43.6146, lon: 3.8825 }; // Corum
const destination = { lat: 43.607, lon: 3.917 }; // Odysseum

function busTramSegment(): JourneySegment {
  return {
    mode: TransportMode.Tram,
    durationSeconds: 600,
    from: { name: 'Corum', lat: 43.615, lon: 3.883 },
    to: { name: 'Odysseum', lat: 43.6065, lon: 3.9165 },
  };
}

function mockGeocoding(results: Array<{ lat: number; lon: number }>) {
  return { geocode: jest.fn().mockResolvedValue(results) };
}

function mockGtfsRt(snapshot: GtfsRtSnapshot | null) {
  return { getSnapshot: () => snapshot };
}

function mockWalkProvider() {
  return {
    getSegments: jest.fn((from, to) =>
      Promise.resolve([
        {
          mode: TransportMode.Marche,
          durationSeconds: 120,
          from: { name: '', ...from },
          to: { name: '', ...to },
        },
      ]),
    ),
  };
}

describe('JourneyPlannerService', () => {
  it('returns a Journey chaining Marche + Tram + Marche when a Bus/Tram segment is found', async () => {
    const busTramProvider = {
      getSegments: jest.fn().mockResolvedValue([busTramSegment()]),
    };
    const bikeProvider = { getSegments: jest.fn().mockResolvedValue([]) };
    const walkProvider = mockWalkProvider();
    const service = new JourneyPlannerService(
      mockGeocoding([]) as never,
      mockGtfsRt({ vehicles: [], fetchedAt: new Date() }) as never,
      busTramProvider as never,
      bikeProvider as never,
      walkProvider as never,
    );

    const journeys = await service.plan(
      { origin: { coordinates: origin }, destination: { coordinates: destination } } as never,
      new Date(),
    );

    expect(journeys).toHaveLength(1);
    const [journey] = journeys;
    expect(journey.segments.map((s) => s.mode)).toEqual([
      TransportMode.Marche,
      TransportMode.Tram,
      TransportMode.Marche,
    ]);
    expect(journey.degraded).toBe(false);
    expect(journey.durationSeconds).toBe(120 + 600 + 120);
  });

  it('marks the Journey as degraded when GTFS-RT has no snapshot', async () => {
    const busTramProvider = {
      getSegments: jest.fn().mockResolvedValue([busTramSegment()]),
    };
    const bikeProvider = { getSegments: jest.fn().mockResolvedValue([]) };
    const service = new JourneyPlannerService(
      mockGeocoding([]) as never,
      mockGtfsRt(null) as never,
      busTramProvider as never,
      bikeProvider as never,
      mockWalkProvider() as never,
    );

    const journeys = await service.plan(
      { origin: { coordinates: origin }, destination: { coordinates: destination } } as never,
      new Date(),
    );

    expect(journeys[0].degraded).toBe(true);
  });

  it('falls back to a direct Marche journey when no provider finds a segment', async () => {
    const busTramProvider = { getSegments: jest.fn().mockResolvedValue([]) };
    const bikeProvider = { getSegments: jest.fn().mockResolvedValue([]) };
    const walkProvider = mockWalkProvider();
    const service = new JourneyPlannerService(
      mockGeocoding([]) as never,
      mockGtfsRt({ vehicles: [], fetchedAt: new Date() }) as never,
      busTramProvider as never,
      bikeProvider as never,
      walkProvider as never,
    );

    const journeys = await service.plan(
      { origin: { coordinates: origin }, destination: { coordinates: destination } } as never,
      new Date(),
    );

    expect(journeys).toHaveLength(1);
    expect(journeys[0].segments.map((s) => s.mode)).toEqual([
      TransportMode.Marche,
    ]);
  });

  it('geocodes an address-only origin/destination before planning', async () => {
    const busTramProvider = {
      getSegments: jest.fn().mockResolvedValue([busTramSegment()]),
    };
    const bikeProvider = { getSegments: jest.fn().mockResolvedValue([]) };
    const geocoding = mockGeocoding([{ lat: 43.6146, lon: 3.8825 }]);
    const service = new JourneyPlannerService(
      geocoding as never,
      mockGtfsRt({ vehicles: [], fetchedAt: new Date() }) as never,
      busTramProvider as never,
      bikeProvider as never,
      mockWalkProvider() as never,
    );

    await service.plan(
      {
        origin: { address: 'Corum, Montpellier' },
        destination: { coordinates: destination },
      } as never,
      new Date(),
    );

    expect(geocoding.geocode).toHaveBeenCalledWith('Corum, Montpellier');
    expect(busTramProvider.getSegments).toHaveBeenCalledWith(
      { lat: 43.6146, lon: 3.8825 },
      destination,
      expect.any(Date),
    );
  });

  it('throws BadRequestException when an address cannot be geocoded', async () => {
    const geocoding = mockGeocoding([]);
    const service = new JourneyPlannerService(
      geocoding as never,
      mockGtfsRt(null) as never,
      { getSegments: jest.fn() } as never,
      { getSegments: jest.fn() } as never,
      mockWalkProvider() as never,
    );

    await expect(
      service.plan(
        {
          origin: { address: 'adresse inexistante' },
          destination: { coordinates: destination },
        } as never,
        new Date(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a point has neither coordinates nor address', async () => {
    const service = new JourneyPlannerService(
      mockGeocoding([]) as never,
      mockGtfsRt(null) as never,
      { getSegments: jest.fn() } as never,
      { getSegments: jest.fn() } as never,
      mockWalkProvider() as never,
    );

    await expect(
      service.plan(
        { origin: {}, destination: { coordinates: destination } } as never,
        new Date(),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
