import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { transit_realtime } from 'gtfs-realtime-bindings';
import {
  GtfsRtSnapshot,
  ServiceAlert,
  TripStopDelay,
  VehiclePosition,
  tripStopKey,
} from './gtfs-rt.types';

// ponytail: PRD KPI is <=30s staleness for GTFS-RT; poll at half that so the
// cache is never more than ~30s stale. ponytail: 30s, not 15s — TaM throttles
// TripUpdate.pb hard enough that a single client polling every 20s still gets
// HTTP 429 about half the time (measured 2026-09-01, with this service stopped),
// so a tighter interval buys no freshness and only risks a ban.
const POLL_INTERVAL_MS = 30_000;

// A snapshot older than this is served as "degraded" (theoretical schedules)
// rather than passed off as real-time.
//
// ponytail: pinned to the PRD's 30s freshness KPI, NOT derived from
// POLL_INTERVAL_MS. It used to be 3x the poll; at a 30s poll that would be 90s,
// which would serve minute-and-a-half-old positions as live and break the KPI.
// The cost of pinning it is that one missed refresh now flips the UI to
// degraded — which is the honest reading, since the data really is over 30s old
// at that point.
const STALE_AFTER_MS = 30_000;

// ponytail: alerts are polled on their own, much slower interval. Polling all
// three feeds x two networks at 15s made data.montpellier3m.fr answer HTTP 429
// (observed 2026-08-29) — six requests every 15s is 3x what this service used
// to send. Disruptions are published by a human and last hours, so a 5-minute
// refresh is ample, and it takes the steady-state load back down to four
// requests per 15s. This does NOT affect the 45s staleness threshold:
// STALE_AFTER_MS measures the vehicle/delay snapshot, which is still refreshed
// every 15s; alerts carry their own activePeriod and are filtered on it at
// read time, so a 5-minute-old alert list cannot show an expired disruption.
// Upgrade path if 429s persist: stagger the two networks, or back off on 429.
const ALERT_POLL_INTERVAL_MS = 5 * 60_000;

// Defaults are the real published TaM endpoints (see endpoints.md), so the
// four new feeds work without touching .env. Overridable per-env all the same.
const DEFAULT_TRIP_UPDATE_URLS = [
  'https://data.montpellier3m.fr/GTFS/Urbain/TripUpdate.pb',
  'https://data.montpellier3m.fr/GTFS/Suburbain/TripUpdate.pb',
];
const DEFAULT_ALERT_URLS = [
  'https://data.montpellier3m.fr/GTFS/Urbain/Alert.pb',
  'https://data.montpellier3m.fr/GTFS/Suburbain/Alert.pb',
];

@Injectable()
export class GtfsRtService implements OnModuleInit {
  private readonly logger = new Logger(GtfsRtService.name);
  private readonly vehiclePositionUrls: string[];
  private readonly tripUpdateUrls: string[];
  private readonly alertUrls: string[];
  private snapshot: GtfsRtSnapshot | null = null;
  // Refreshed on ALERT_POLL_INTERVAL_MS, not on every snapshot refresh; the
  // snapshot copies whatever is cached here so getActiveAlerts keeps reading
  // one place. A failed alert poll leaves the previous list standing.
  private alerts: ServiceAlert[] = [];

  constructor(config: ConfigService) {
    this.vehiclePositionUrls = [
      config.getOrThrow<string>('GTFS_RT_URBAIN_VEHICLE_POSITION_URL'),
      config.getOrThrow<string>('GTFS_RT_SUBURBAIN_VEHICLE_POSITION_URL'),
    ];
    // ponytail: get() with a default, not getOrThrow() — the two
    // VehiclePosition vars predate this and sit in every existing .env, but a
    // getOrThrow on a brand-new var would break every e2e suite the moment it
    // boots AppModule against an un-updated .env. The published URLs are
    // stable and documented in endpoints.md, so defaulting to them is honest
    // rather than a silent no-op.
    this.tripUpdateUrls = [
      config.get<string>(
        'GTFS_RT_URBAIN_TRIP_UPDATE_URL',
        DEFAULT_TRIP_UPDATE_URLS[0],
      ),
      config.get<string>(
        'GTFS_RT_SUBURBAIN_TRIP_UPDATE_URL',
        DEFAULT_TRIP_UPDATE_URLS[1],
      ),
    ];
    this.alertUrls = [
      config.get<string>('GTFS_RT_URBAIN_ALERT_URL', DEFAULT_ALERT_URLS[0]),
      config.get<string>('GTFS_RT_SUBURBAIN_ALERT_URL', DEFAULT_ALERT_URLS[1]),
    ];
  }

  async onModuleInit(): Promise<void> {
    // Alerts first, so the very first snapshot already carries them.
    await this.refreshAlerts();
    await this.refresh();
  }

  @Interval(POLL_INTERVAL_MS)
  async refresh(): Promise<void> {
    try {
      // ponytail: allSettled, not all — TaM throttles the two feeds
      // independently, and Promise.all would throw away a VehiclePosition that
      // answered 200 just because its TripUpdate sibling returned 429.
      const [vehicleFeeds, tripUpdateFeeds] = await Promise.all([
        this.fetchFeeds(this.vehiclePositionUrls),
        this.fetchFeeds(this.tripUpdateUrls),
      ]);

      // A feed group that answered nothing must not overwrite what it holds
      // with an empty result that still looks fresh — the delay index in
      // particular, since an empty Map reads as "no train is late".
      if (vehicleFeeds.failures.length > 0 && vehicleFeeds.entities.length === 0) {
        throw new Error(vehicleFeeds.failures[0]);
      }
      if (tripUpdateFeeds.failures.length > 0 && tripUpdateFeeds.entities.length === 0) {
        throw new Error(tripUpdateFeeds.failures[0]);
      }

      this.snapshot = {
        vehicles: vehicleFeeds.entities.flatMap(toVehiclePositions),
        delays: new Map(
          tripUpdateFeeds.entities
            .flatMap(toTripStopDelays)
            .map((d) => [tripStopKey(d.tripId, d.stopId), d]),
        ),
        alerts: this.alerts,
        fetchedAt: new Date(),
      };

      // A throttled feed is expected here and already handled by keeping the
      // rest of the snapshot, so it is not an error — logging it as one made
      // the console shout every cycle about a non-event.
      const failures = [...vehicleFeeds.failures, ...tripUpdateFeeds.failures];
      if (failures.length > 0) {
        this.logger.warn(
          `GTFS-RT partial refresh, kept ${failures.length} feed(s) from the previous snapshot: ${failures.join('; ')}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `GTFS-RT refresh failed, keeping previous snapshot: ${(err as Error).message}`,
      );
    }
  }

  @Interval(ALERT_POLL_INTERVAL_MS)
  async refreshAlerts(): Promise<void> {
    try {
      const alertFeeds = await Promise.all(
        this.alertUrls.map((u) => this.fetchFeed(u)),
      );
      this.alerts = alertFeeds.flatMap(toServiceAlerts);
      // The live snapshot must see the new list without waiting for the next
      // 15s refresh — otherwise a just-published disruption stays invisible.
      if (this.snapshot) {
        this.snapshot = { ...this.snapshot, alerts: this.alerts };
      }
    } catch (err) {
      this.logger.error(
        `GTFS-RT alert refresh failed, keeping previous alerts: ${(err as Error).message}`,
      );
    }
  }

  getSnapshot(): GtfsRtSnapshot | null {
    return this.snapshot;
  }

  // A stale snapshot is worse than no snapshot: it gets presented as
  // real-time while describing a network state minutes gone. `now` is a
  // parameter so this is testable without faking the clock.
  isFresh(now: Date = new Date()): boolean {
    return (
      this.snapshot !== null &&
      now.getTime() - this.snapshot.fetchedAt.getTime() <= STALE_AFTER_MS
    );
  }

  // Alerts whose active period covers `now`. An alert with no bounds is
  // treated as currently active — GTFS-RT's own reading of an absent
  // activePeriod. Returns nothing on a stale snapshot, for the same reason
  // isFresh exists: an expired disruption is misinformation.
  getActiveAlerts(now: Date = new Date()): ServiceAlert[] {
    if (!this.isFresh(now)) return [];
    return this.snapshot!.alerts.filter(
      (a) =>
        (a.activeFrom === null || a.activeFrom <= now) &&
        (a.activeUntil === null || a.activeUntil >= now),
    );
  }

  // Fetches every URL, keeping whatever answered and reporting the rest, so one
  // throttled endpoint cannot discard its siblings' data.
  private async fetchFeeds(urls: string[]): Promise<{
    entities: transit_realtime.IFeedEntity[][];
    failures: string[];
  }> {
    const results = await Promise.allSettled(
      urls.map((u) => this.fetchFeed(u)),
    );
    const entities: transit_realtime.IFeedEntity[][] = [];
    const failures: string[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') entities.push(result.value);
      else failures.push((result.reason as Error).message);
    }
    return { entities, failures };
  }

  private async fetchFeed(
    url: string,
  ): Promise<transit_realtime.IFeedEntity[]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GTFS-RT HTTP ${response.status} (${url})`);
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer)
      .entity;
  }
}

function toVehiclePositions(
  entities: transit_realtime.IFeedEntity[],
): VehiclePosition[] {
  return entities
    .filter((entity) => entity.vehicle?.position)
    .map((entity) => {
      const vehicle = entity.vehicle!;
      const position = vehicle.position!;
      return {
        vehicleId: vehicle.vehicle?.id ?? entity.id,
        tripId: vehicle.trip?.tripId ?? null,
        routeId: vehicle.trip?.routeId ?? null,
        lat: position.latitude,
        lon: position.longitude,
        bearing: position.bearing ?? null,
        speed: position.speed ?? null,
        timestamp: vehicle.timestamp
          ? new Date(Number(vehicle.timestamp) * 1000)
          : new Date(),
      };
    });
}

// TaM publishes its real-time trip_id as `<GTFS trip_id>-<N>` (a run counter
// the static feed does not carry), so the raw value never matches gtfs_trip.
// ponytail: measured against the real feed and a full TaM GTFS import on
// 2026-08-29 — 0/38 RT tripIds matched the 28380 imported trips as published,
// 36/38 after stripping a trailing `-\d+`. A quirk of the TaM producer, NOT a
// rule of the GTFS-RT standard, so it is normalised here at the feed boundary
// rather than in the SQL, which holds the canonical GTFS value.
//
// Both forms are indexed rather than picking one: `-\d+` cannot tell a run
// counter apart from an id that merely ends in digits (the 2 ids that still
// do not match are shaped `4-2-T221-0-014300`, which a strip would mangle
// into `4-2-T221-0`). Indexing raw AND stripped means a real trip matches on
// whichever form the static feed actually holds, while an id we cannot
// identify matches neither and falls back to the theoretical schedule with
// realtime:false. Upgrade path: drop the extra key if TaM ever publishes
// canonical ids.
function tripIdVariants(tripId: string): string[] {
  const stripped = tripId.replace(/-\d+$/, '');
  return stripped === tripId ? [tripId] : [tripId, stripped];
}

function toTripStopDelays(
  entities: transit_realtime.IFeedEntity[],
): TripStopDelay[] {
  const delays: TripStopDelay[] = [];
  for (const entity of entities) {
    const rawTripId = entity.tripUpdate?.trip?.tripId;
    if (!rawTripId) continue;
    // Trip-level delay, used when the producer publishes one for the whole
    // trip instead of per stop_time_update.
    const tripDelay = entity.tripUpdate?.delay ?? null;
    for (const update of entity.tripUpdate?.stopTimeUpdate ?? []) {
      if (!update.stopId) continue;
      // ponytail: only `delay` is read, never the absolute epoch `time` on
      // arrival/departure — deriving a delay from `time` needs the trip's own
      // static stop_time to subtract from, which lives in Postgres, not here.
      // Upgrade path: pass the scheduled epoch into the lookup and subtract
      // there, in BusTramMobilityProvider, where the stop_time is already in
      // hand.
      const delaySeconds =
        update.departure?.delay ?? update.arrival?.delay ?? tripDelay;
      if (delaySeconds === null || delaySeconds === undefined) continue;
      for (const tripId of tripIdVariants(rawTripId)) {
        delays.push({ tripId, stopId: update.stopId, delaySeconds });
      }
    }
  }
  return delays;
}

function toServiceAlerts(
  entities: transit_realtime.IFeedEntity[],
): ServiceAlert[] {
  return entities
    .filter((entity) => entity.alert)
    .map((entity) => {
      const alert = entity.alert!;
      // ponytail: only the first activePeriod is kept — GTFS-RT allows a list
      // (a disruption recurring over several windows). One window covers
      // TaM's feed; upgrade path is to keep the array and test `some()`.
      const period = alert.activePeriod?.[0];
      return {
        id: entity.id,
        routeIds: (alert.informedEntity ?? [])
          .map((e) => e.routeId)
          .filter((id): id is string => Boolean(id)),
        header: frenchTranslation(alert.headerText),
        description: frenchTranslation(alert.descriptionText),
        activeFrom: period?.start
          ? new Date(Number(period.start) * 1000)
          : null,
        activeUntil: period?.end ? new Date(Number(period.end) * 1000) : null,
      };
    });
}

// TaM publishes FR (sometimes alongside EN); prefer FR, fall back to whatever
// translation is offered rather than rendering an empty banner.
function frenchTranslation(
  text: transit_realtime.ITranslatedString | null | undefined,
): string {
  const translations = text?.translation ?? [];
  const fr = translations.find((t) =>
    t.language?.toLowerCase().startsWith('fr'),
  );
  return (fr ?? translations[0])?.text ?? '';
}
