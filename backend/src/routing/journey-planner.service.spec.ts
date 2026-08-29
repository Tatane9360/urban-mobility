import { BadRequestException } from '@nestjs/common';
import { CarbonService } from '../carbon/carbon.service';
import { TransportMode } from '../common/transport-mode.enum';
import { GeocodingService } from '../integration/geocoding.service';
import { GtfsRtService } from '../integration/gtfs-rt.service';
import { GtfsRtSnapshot, ServiceAlert } from '../integration/gtfs-rt.types';
import { BikeMobilityProvider } from './bike.mobility-provider';
import { BusTramMobilityProvider } from './bus-tram.mobility-provider';
import { PlanJourneyDto } from './dto/plan-journey.dto';
import { GeoPoint } from './geo-point';
import { Repository } from 'typeorm';
import { MobilityProfile } from '../auth/entities/mobility-profile.entity';
import { JourneyPlannerService } from './journey-planner.service';
import { RawJourneySegment } from './journey-segment';
import { WalkMobilityProvider } from './walk.mobility-provider';

const origin = { lat: 43.6146, lon: 3.8825 }; // Corum
const destination = { lat: 43.607, lon: 3.917 }; // Odysseum
const carbonService = new CarbonService();

function busTramSegment(): RawJourneySegment {
  return {
    mode: TransportMode.Tram,
    durationSeconds: 600,
    distanceMeters: 3400,
    from: { name: 'Corum', lat: 43.615, lon: 3.883 },
    to: { name: 'Odysseum', lat: 43.6065, lon: 3.9165 },
  };
}

function mockGeocoding(
  results: Array<{ lat: number; lon: number }>,
): GeocodingService {
  return {
    geocode: jest.fn().mockResolvedValue(results),
  } as unknown as GeocodingService;
}

function freshSnapshot(
  overrides: Partial<GtfsRtSnapshot> = {},
): GtfsRtSnapshot {
  return {
    vehicles: [],
    delays: new Map(),
    alerts: [],
    fetchedAt: new Date(),
    ...overrides,
  };
}

// Mirrors the real service: fresh iff a snapshot exists and is within the
// staleness window. Tests that want "stale" hand in an old fetchedAt.
function mockGtfsRt(snapshot: GtfsRtSnapshot | null): GtfsRtService {
  const isFresh = (now: Date = new Date()) =>
    snapshot !== null && now.getTime() - snapshot.fetchedAt.getTime() <= 45_000;
  return {
    getSnapshot: () => snapshot,
    isFresh,
    getActiveAlerts: (now: Date = new Date()) =>
      isFresh(now)
        ? (snapshot?.alerts ?? []).filter(
            (a) =>
              (a.activeFrom === null || a.activeFrom <= now) &&
              (a.activeUntil === null || a.activeUntil >= now),
          )
        : [],
  } as unknown as GtfsRtService;
}

function mockWalkProvider(): WalkMobilityProvider {
  return {
    getSegments: jest.fn((from: GeoPoint, to: GeoPoint) =>
      Promise.resolve([
        {
          mode: TransportMode.Marche,
          durationSeconds: 120,
          distanceMeters: 150,
          from: { name: '', ...from },
          to: { name: '', ...to },
        },
      ]),
    ),
  } as unknown as WalkMobilityProvider;
}

interface JourneyPointInput {
  coordinates?: { lat: number; lon: number };
  address?: string;
}

function planDto(
  origin: JourneyPointInput,
  destination: JourneyPointInput,
  sort?: 'duration' | 'carbon',
): PlanJourneyDto {
  return { origin, destination, sort };
}

// The planner only reads the profile to resolve preferred modes; a missing
// profile (the guest case) is the same "no filter" as an empty one.
function mockProfiles(
  preferredModes: string[] | null = null,
): Repository<MobilityProfile> {
  return {
    findOne: jest
      .fn()
      .mockResolvedValue(preferredModes === null ? null : { preferredModes }),
  } as unknown as Repository<MobilityProfile>;
}

describe('JourneyPlannerService', () => {
  it('returns a Journey chaining Marche + Tram + Marche alongside the direct Marche candidate', async () => {
    const busTramProvider = {
      getSegments: jest.fn().mockResolvedValue([busTramSegment()]),
    } as unknown as BusTramMobilityProvider;
    const bikeProvider = {
      getSegments: jest.fn().mockResolvedValue([]),
    } as unknown as BikeMobilityProvider;
    const walkProvider = mockWalkProvider();
    const service = new JourneyPlannerService(
      mockGeocoding([]),
      mockGtfsRt(freshSnapshot()),
      carbonService,
      busTramProvider,
      bikeProvider,
      walkProvider,
      mockProfiles(),
    );

    const journeys = await service.plan(
      planDto({ coordinates: origin }, { coordinates: destination }),
      new Date(),
    );

    // Direct Marche (120s, mocked) is always computed alongside the transit
    // candidate — the planner no longer treats Marche as a last-resort
    // fallback (see mode-icon picker on the results screen).
    expect(journeys).toHaveLength(2);
    const transitJourney = journeys.find((j) =>
      j.segments.some((s) => s.mode === TransportMode.Tram),
    )!;
    expect(transitJourney.segments.map((s) => s.mode)).toEqual([
      TransportMode.Marche,
      TransportMode.Tram,
      TransportMode.Marche,
    ]);
    expect(transitJourney.degraded).toBe(false);
    expect(transitJourney.durationSeconds).toBe(120 + 600 + 120);
    expect(transitJourney.carbonGrams).toBeGreaterThan(0);
    expect(transitJourney.carComparison.carCarbonGrams).toBeGreaterThan(
      transitJourney.carbonGrams,
    );

    const directWalkJourney = journeys.find(
      (j) =>
        j.segments.length === 1 && j.segments[0].mode === TransportMode.Marche,
    )!;
    expect(directWalkJourney.durationSeconds).toBe(120);
  });

  it('marks the Journey as degraded when GTFS-RT has no snapshot', async () => {
    const busTramProvider = {
      getSegments: jest.fn().mockResolvedValue([busTramSegment()]),
    } as unknown as BusTramMobilityProvider;
    const bikeProvider = {
      getSegments: jest.fn().mockResolvedValue([]),
    } as unknown as BikeMobilityProvider;
    const service = new JourneyPlannerService(
      mockGeocoding([]),
      mockGtfsRt(null),
      carbonService,
      busTramProvider,
      bikeProvider,
      mockWalkProvider(),
      mockProfiles(),
    );

    const journeys = await service.plan(
      planDto({ coordinates: origin }, { coordinates: destination }),
      new Date(),
    );

    expect(journeys[0].degraded).toBe(true);
  });

  it('marks the Journey as degraded when the GTFS-RT snapshot is stale', async () => {
    // A snapshot exists — the old `getSnapshot() === null` check would call
    // this fresh — but it was fetched 10 minutes ago. Serving it as real-time
    // is exactly the KPI-3 breach this guards.
    const busTramProvider = {
      getSegments: jest.fn().mockResolvedValue([busTramSegment()]),
    } as unknown as BusTramMobilityProvider;
    // fetchedAt is 10 minutes before the real wall clock — freshness is
    // measured against Date.now(), not the itinerary's departureTime.
    const now = new Date('2026-07-10T08:00:00Z');
    const service = new JourneyPlannerService(
      mockGeocoding([]),
      mockGtfsRt(freshSnapshot({ fetchedAt: new Date(Date.now() - 600_000) })),
      carbonService,
      busTramProvider,
      {
        getSegments: jest.fn().mockResolvedValue([]),
      } as unknown as BikeMobilityProvider,
      mockWalkProvider(),
      mockProfiles(),
    );

    const journeys = await service.plan(
      planDto({ coordinates: origin }, { coordinates: destination }),
      now,
    );

    expect(journeys.every((j) => j.degraded)).toBe(true);
  });

  it('attaches active ServiceAlerts to the transit segment whose routeId they name', async () => {
    // Alert activity is judged against the wall clock, like freshness.
    const now = new Date('2026-07-10T08:00:00Z');
    const alert: ServiceAlert = {
      id: 'ALERT_1',
      routeIds: ['L1'],
      header: 'Travaux ligne 1',
      description: 'Interruption entre Corum et Odysseum',
      activeFrom: new Date(Date.now() - 60_000),
      activeUntil: new Date(Date.now() + 60_000),
    };
    const busTramProvider = {
      getSegments: jest
        .fn()
        .mockResolvedValue([{ ...busTramSegment(), routeId: 'L1' }]),
    } as unknown as BusTramMobilityProvider;
    const service = new JourneyPlannerService(
      mockGeocoding([]),
      mockGtfsRt(freshSnapshot({ alerts: [alert] })),
      carbonService,
      busTramProvider,
      {
        getSegments: jest.fn().mockResolvedValue([]),
      } as unknown as BikeMobilityProvider,
      mockWalkProvider(),
      mockProfiles(),
    );

    const journeys = await service.plan(
      planDto({ coordinates: origin }, { coordinates: destination }),
      now,
    );

    const transitJourney = journeys.find((j) =>
      j.segments.some((s) => s.mode === TransportMode.Tram),
    )!;
    const tram = transitJourney.segments.find(
      (s) => s.mode === TransportMode.Tram,
    )!;
    expect(tram.alerts).toEqual([alert]);
    // The bridging Marche segments have no routeId, so nothing attaches.
    expect(
      transitJourney.segments
        .filter((s) => s.mode === TransportMode.Marche)
        .every((s) => s.alerts === undefined),
    ).toBe(true);
  });

  it('does not attach an alert naming a different routeId', async () => {
    const now = new Date('2026-07-10T08:00:00Z');
    const busTramProvider = {
      getSegments: jest
        .fn()
        .mockResolvedValue([{ ...busTramSegment(), routeId: 'L1' }]),
    } as unknown as BusTramMobilityProvider;
    const service = new JourneyPlannerService(
      mockGeocoding([]),
      mockGtfsRt(
        freshSnapshot({
          alerts: [
            {
              id: 'ALERT_2',
              routeIds: ['L4'],
              header: 'Ligne 4 perturbée',
              description: '',
              activeFrom: null,
              activeUntil: null,
            },
          ],
        }),
      ),
      carbonService,
      busTramProvider,
      {
        getSegments: jest.fn().mockResolvedValue([]),
      } as unknown as BikeMobilityProvider,
      mockWalkProvider(),
      mockProfiles(),
    );

    const journeys = await service.plan(
      planDto({ coordinates: origin }, { coordinates: destination }),
      now,
    );

    const tram = journeys
      .flatMap((j) => j.segments)
      .find((s) => s.mode === TransportMode.Tram)!;
    expect(tram.alerts).toBeUndefined();
  });

  it('returns only the direct Marche journey when no transit/bike candidate is found', async () => {
    const busTramProvider = {
      getSegments: jest.fn().mockResolvedValue([]),
    } as unknown as BusTramMobilityProvider;
    const bikeProvider = {
      getSegments: jest.fn().mockResolvedValue([]),
    } as unknown as BikeMobilityProvider;
    const walkProvider = mockWalkProvider();
    const service = new JourneyPlannerService(
      mockGeocoding([]),
      mockGtfsRt(freshSnapshot()),
      carbonService,
      busTramProvider,
      bikeProvider,
      walkProvider,
      mockProfiles(),
    );

    const journeys = await service.plan(
      planDto({ coordinates: origin }, { coordinates: destination }),
      new Date(),
    );

    expect(journeys).toHaveLength(1);
    expect(journeys[0].segments.map((s) => s.mode)).toEqual([
      TransportMode.Marche,
    ]);
  });

  it('geocodes an address-only origin/destination before planning', async () => {
    const getBusTramSegments = jest.fn().mockResolvedValue([busTramSegment()]);
    const busTramProvider = {
      getSegments: getBusTramSegments,
    } as unknown as BusTramMobilityProvider;
    const bikeProvider = {
      getSegments: jest.fn().mockResolvedValue([]),
    } as unknown as BikeMobilityProvider;
    const geocode = jest
      .fn()
      .mockResolvedValue([{ lat: 43.6146, lon: 3.8825 }]);
    const geocoding = { geocode } as unknown as GeocodingService;
    const service = new JourneyPlannerService(
      geocoding,
      mockGtfsRt(freshSnapshot()),
      carbonService,
      busTramProvider,
      bikeProvider,
      mockWalkProvider(),
      mockProfiles(),
    );

    await service.plan(
      planDto({ address: 'Corum, Montpellier' }, { coordinates: destination }),
      new Date(),
    );

    expect(geocode).toHaveBeenCalledWith('Corum, Montpellier');
    expect(getBusTramSegments).toHaveBeenCalledWith(
      { lat: 43.6146, lon: 3.8825 },
      destination,
      expect.any(Date),
    );
  });

  it('throws BadRequestException when an address cannot be geocoded', async () => {
    const geocoding = mockGeocoding([]);
    const service = new JourneyPlannerService(
      geocoding,
      mockGtfsRt(null),
      carbonService,
      { getSegments: jest.fn() } as unknown as BusTramMobilityProvider,
      { getSegments: jest.fn() } as unknown as BikeMobilityProvider,
      mockWalkProvider(),
      mockProfiles(),
    );

    await expect(
      service.plan(
        planDto(
          { address: 'adresse inexistante' },
          { coordinates: destination },
        ),
        new Date(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a point has neither coordinates nor address', async () => {
    const service = new JourneyPlannerService(
      mockGeocoding([]),
      mockGtfsRt(null),
      carbonService,
      { getSegments: jest.fn() } as unknown as BusTramMobilityProvider,
      { getSegments: jest.fn() } as unknown as BikeMobilityProvider,
      mockWalkProvider(),
      mockProfiles(),
    );

    await expect(
      service.plan(planDto({}, { coordinates: destination }), new Date()),
    ).rejects.toThrow(BadRequestException);
  });

  it('sorts Journeys by carbon when sort=carbon is requested', async () => {
    // Tram candidate: low carbon (Tram factor is small). Bike candidate:
    // zero carbon (Vélo factor is 0) but let's make Bike slower so duration
    // sort and carbon sort disagree. The direct Marche candidate is made
    // slower than both (3600s) so it doesn't dominate either sort and mask
    // the Tram-vs-Vélo comparison under test.
    const busTramProvider = {
      getSegments: jest.fn().mockResolvedValue([
        {
          mode: TransportMode.Tram,
          durationSeconds: 300,
          distanceMeters: 3400,
          from: { name: 'Corum', lat: 43.615, lon: 3.883 },
          to: { name: 'Odysseum', lat: 43.6065, lon: 3.9165 },
        },
      ]),
    } as unknown as BusTramMobilityProvider;
    const bikeProvider = {
      getSegments: jest.fn().mockResolvedValue([
        {
          mode: TransportMode.Velo,
          durationSeconds: 900,
          distanceMeters: 3400,
          from: { name: 'Station A', lat: 43.615, lon: 3.883 },
          to: { name: 'Station B', lat: 43.6065, lon: 3.9165 },
        },
      ]),
    } as unknown as BikeMobilityProvider;
    // The same WalkMobilityProvider is used both for bridging walks (short,
    // stop-to-search-point) and the direct candidate (long, origin-to-
    // destination) — distinguish them by distance so bridging walks stay
    // negligible while the direct Marche candidate is deliberately slow.
    const slowWalkProvider = {
      getSegments: jest.fn((from: GeoPoint, to: GeoPoint) => {
        const isDirect =
          Math.abs(from.lat - origin.lat) < 1e-6 &&
          Math.abs(to.lat - destination.lat) < 1e-6;
        return Promise.resolve([
          {
            mode: TransportMode.Marche,
            durationSeconds: isDirect ? 3600 : 30,
            distanceMeters: isDirect ? 4500 : 40,
            from: { name: '', ...from },
            to: { name: '', ...to },
          },
        ]);
      }),
    } as unknown as WalkMobilityProvider;
    const service = new JourneyPlannerService(
      mockGeocoding([]),
      mockGtfsRt(freshSnapshot()),
      carbonService,
      busTramProvider,
      bikeProvider,
      slowWalkProvider,
      mockProfiles(),
    );

    const byDuration = await service.plan(
      planDto(
        { coordinates: origin },
        { coordinates: destination },
        'duration',
      ),
      new Date(),
    );
    const byCarbon = await service.plan(
      planDto({ coordinates: origin }, { coordinates: destination }, 'carbon'),
      new Date(),
    );

    // Duration sort: Tram journey (300s core + walks) is faster than Bike (900s core + walks).
    expect(
      byDuration[0].segments.some((s) => s.mode === TransportMode.Tram),
    ).toBe(true);
    // Carbon sort: Vélo has a 0 g/km factor, strictly less carbon than Tram.
    expect(
      byCarbon[0].segments.some((s) => s.mode === TransportMode.Velo),
    ).toBe(true);
    expect(byDuration[0]).not.toBe(byCarbon[0]);
  });
});
