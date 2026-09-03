import { TransportMode } from '../common/transport-mode.enum';
import { Ride } from '../integration/ride';
import { toSegment } from './bus-tram.mobility-provider';

// Mosson 08:00 -> Odysseum 08:30, matching the e2e fixture's TRIP_L1_1. Held
// as a literal Ride: the GTFS referential is behind its own seam now, so the
// delay rules below need no database to exercise.
function ride(overrides: Partial<Ride> = {}): Ride {
  return {
    tripId: 'TRIP_L1_1',
    routeId: 'L1',
    routeShortName: '1',
    tripHeadsign: 'Odysseum',
    isTram: true,
    boarding: {
      stopId: 'STOP_MOSSON',
      name: 'Mosson',
      lat: 43.622,
      lon: 3.803,
    },
    alighting: {
      stopId: 'STOP_ODYSSEUM',
      name: 'Odysseum',
      lat: 43.607,
      lon: 3.917,
    },
    scheduledDepartureSeconds: 8 * 3600,
    scheduledArrivalSeconds: 8 * 3600 + 30 * 60,
    ...overrides,
  };
}

// Stands in for a GTFS-RT snapshot: the delay published at each stop, if any.
function delaysAt(published: Record<string, number>) {
  return (stopId: string) => published[stopId] ?? null;
}

const noDelays = () => null;
const searchDay = new Date('2026-07-10T07:00:00');

describe('toSegment', () => {
  it('builds a Tram segment from the theoretical schedule when the feed is silent', () => {
    const segment = toSegment(ride(), searchDay, noDelays);

    expect(segment).toMatchObject({
      mode: TransportMode.Tram,
      durationSeconds: 30 * 60,
      realtime: false,
      delaySeconds: 0,
      routeId: 'L1',
      routeShortName: '1',
      from: { name: 'Mosson' },
      to: { name: 'Odysseum' },
    });
  });

  it('reads route_type as Bus for anything that is not a Tram', () => {
    // GTFS 3 = Bus and 715 = shuttle bus both fold into Bus (CONTEXT.md); the
    // repository has already resolved that to isTram: false.
    const segment = toSegment(ride({ isTram: false }), searchDay, noDelays);

    expect(segment.mode).toBe(TransportMode.Bus);
  });

  it('stretches durationSeconds when the delay is at the alighting stop only', () => {
    // The tram left on time and arrives late, so the ride itself is longer.
    const segment = toSegment(
      ride(),
      searchDay,
      delaysAt({ STOP_ODYSSEUM: 180 }),
    );

    expect(segment).toMatchObject({
      durationSeconds: 30 * 60 + 180,
      realtime: true,
      // Boarding is unaffected — the delay is at the far end.
      delaySeconds: 0,
    });
  });

  it('carries a boarding delay forward to the arrival, leaving the ride length unchanged', () => {
    // The whole trip shifts 3 minutes later: the rider waits longer, but the
    // ride is not slower. Without the carry-forward the segment would claim a
    // miraculous 3-minute catch-up.
    const segment = toSegment(
      ride(),
      searchDay,
      delaysAt({ STOP_MOSSON: 180 }),
    );

    expect(segment).toMatchObject({
      durationSeconds: 30 * 60,
      realtime: true,
      delaySeconds: 180,
    });
  });

  it('shifts the boarding time by the departure delay', () => {
    const onTime = toSegment(ride(), searchDay, noDelays);
    const late = toSegment(ride(), searchDay, delaysAt({ STOP_MOSSON: 180 }));

    // Built on the searched calendar day, not on the search time itself.
    expect(onTime.scheduledDeparture).toEqual(new Date('2026-07-10T08:00:00'));
    expect(late.scheduledDeparture).toEqual(new Date('2026-07-10T08:03:00'));
  });

  it('applies both delays independently when the feed publishes each stop', () => {
    const segment = toSegment(
      ride(),
      searchDay,
      delaysAt({ STOP_MOSSON: 120, STOP_ODYSSEUM: 300 }),
    );

    // Departure slips 120s, arrival 300s: the ride stretches by the difference.
    expect(segment.durationSeconds).toBe(30 * 60 + 180);
    expect(segment.delaySeconds).toBe(120);
  });

  it('rolls a >24:00:00 departure into the next calendar day', () => {
    // GTFS spells 00:15 the morning after as "24:15:00" on the previous
    // service day. Seconds past midnight lets it roll over on its own.
    const segment = toSegment(
      ride({
        scheduledDepartureSeconds: 24 * 3600 + 15 * 60,
        scheduledArrivalSeconds: 24 * 3600 + 45 * 60,
      }),
      searchDay,
      noDelays,
    );

    expect(segment.scheduledDeparture).toEqual(new Date('2026-07-11T00:15:00'));
    expect(segment.durationSeconds).toBe(30 * 60);
  });

  it('passes the served stops through as the segment geometry', () => {
    const servedStops = [
      { name: 'Mosson', lat: 43.622, lon: 3.803 },
      { name: 'Corum', lat: 43.614, lon: 3.882 },
      { name: 'Odysseum', lat: 43.607, lon: 3.917 },
    ];

    const segment = toSegment(ride({ servedStops }), searchDay, noDelays);

    expect(segment.geometry?.map((p) => p.name)).toEqual([
      'Mosson',
      'Corum',
      'Odysseum',
    ]);
  });

  it('omits the geometry when the ride has no intermediate stop', () => {
    // Two consecutive stops: the chord already is the whole line.
    const segment = toSegment(ride(), searchDay, noDelays);

    expect(segment.geometry).toBeUndefined();
  });
});
