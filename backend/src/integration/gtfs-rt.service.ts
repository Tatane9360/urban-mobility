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
import { GtfsScheduleRepository } from './gtfs-schedule.repository';

// Do not shorten: TaM throttles TripUpdate.pb hard enough that polling every
// 20s still drew HTTP 429 about half the time (measured 2026-09-01). A tighter
// interval buys no freshness and risks a ban.
const POLL_INTERVAL_MS = 30_000;

// Past this, a snapshot is served as "degraded" (theoretical schedules) rather
// than passed off as real-time. Pinned to the PRD's 30s freshness KPI, not
// derived from POLL_INTERVAL_MS: any multiple of the poll would serve
// minute-old positions as live.
const STALE_AFTER_MS = 30_000;

// Alerts poll on their own, far slower interval: they are published by a human
// and last hours, while polling all six feeds at 15s drew 429s. Freshness is
// unaffected — alerts carry their own activePeriod and are filtered on it at
// read time, so an old list cannot show an expired disruption.
const ALERT_POLL_INTERVAL_MS = 5 * 60_000;

// TripUpdate.pb 429s on nearly every cycle (observed 2026-09-03), which a fixed
// 30s retry only sustains. Doubles per consecutive failure — 1m, 2m, 4m, 8m —
// capped so a recovered feed does not stay dark, and reset by any success.
const TRIP_UPDATE_BACKOFF_BASE_MS = 60_000;
const TRIP_UPDATE_BACKOFF_MAX_MS = 10 * 60_000;

// Stands in for a fetch that was never attempted: no entities, and no failures
// either, since a skipped feed did not fail — it was not asked.
const EMPTY_FEEDS: {
  entities: transit_realtime.IFeedEntity[][];
  failures: string[];
} = { entities: [], failures: [] };

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
  // TripUpdate.pb is the feed TaM throttles hardest. These hold the backoff so
  // a 429 stops the next attempt instead of provoking another one.
  private tripUpdateFailures = 0;
  private tripUpdateBackoffUntil: number | null = null;
  // Refreshed on ALERT_POLL_INTERVAL_MS, not on every snapshot refresh; the
  // snapshot copies whatever is cached here so getActiveAlerts keeps reading
  // one place. A failed alert poll leaves the previous list standing.
  private alerts: ServiceAlert[] = [];

  constructor(
    config: ConfigService,
    private readonly scheduleRepository: GtfsScheduleRepository,
  ) {
    this.vehiclePositionUrls = [
      config.getOrThrow<string>('GTFS_RT_URBAIN_VEHICLE_POSITION_URL'),
      config.getOrThrow<string>('GTFS_RT_SUBURBAIN_VEHICLE_POSITION_URL'),
    ];
    // get() with a default, not getOrThrow(): these vars are absent from older
    // .env files, and the published URLs are stable (see endpoints.md).
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
    // The change-only log below stays silent when boot finds zero alerts and
    // the count started at zero — which is the common case, and the one that
    // leaves "am I getting alerts at all?" unanswered. State it once at boot.
    this.logger.log(`GTFS-RT alerts at startup: ${this.alerts.length}`);
    await this.refresh();
  }

  @Interval(POLL_INTERVAL_MS)
  async refresh(): Promise<void> {
    try {
      // fetchFeeds settles each URL independently: TaM throttles the feeds
      // separately, and one 429 must not discard a sibling that answered 200.
      // While backing off, TripUpdate is skipped rather than re-requested.
      const skipTripUpdates = this.tripUpdatesBackedOff();
      const [vehicleFeeds, fetchedTripUpdates] = await Promise.all([
        this.fetchFeeds(this.vehiclePositionUrls),
        skipTripUpdates
          ? Promise.resolve(EMPTY_FEEDS)
          : this.fetchFeeds(this.tripUpdateUrls),
      ]);
      const tripUpdateFeeds = {
        ...fetchedTripUpdates,
        skipped: skipTripUpdates,
      };

      // Positions must survive a throttled TripUpdate. Failing the whole
      // refresh here left fetchedAt untouched, so isFresh() went false and the
      // planner served degraded schedules even though live positions had
      // answered 200 — the recurring 429 on TripUpdate.pb alone was enough to
      // switch real-time off for good.
      if (
        vehicleFeeds.failures.length > 0 &&
        vehicleFeeds.entities.length === 0
      ) {
        throw new Error(vehicleFeeds.failures[0]);
      }

      const tripUpdatesUsable =
        !tripUpdateFeeds.skipped && tripUpdateFeeds.entities.length > 0;
      if (tripUpdateFeeds.failures.length > 0) {
        this.noteTripUpdateFailure(tripUpdateFeeds.failures);
      } else if (!tripUpdateFeeds.skipped) {
        this.tripUpdateBackoffUntil = null;
        this.tripUpdateFailures = 0;
      }

      this.snapshot = {
        vehicles: vehicleFeeds.entities.flatMap(toVehiclePositions),
        // An empty Map reads as "nothing is late", so a failed or skipped
        // TripUpdate carries the previous delays forward instead.
        delays: tripUpdatesUsable
          ? new Map(
              tripUpdateFeeds.entities
                .flatMap(toTripStopDelays)
                .map((d) => [tripStopKey(d.tripId, d.stopId), d]),
            )
          : (this.snapshot?.delays ?? new Map<string, TripStopDelay>()),
        alerts: this.alerts,
        fetchedAt: new Date(),
      };

      // VehiclePosition only: TripUpdate failures are already reported once by
      // noteTripUpdateFailure, and logging them here too printed the same 429
      // twice per cycle. A throttled feed is expected and handled by carrying
      // the previous data forward, so it is a warning, never an error.
      if (vehicleFeeds.failures.length > 0) {
        this.logger.warn(
          `GTFS-RT partial refresh, kept ${vehicleFeeds.failures.length} VehiclePosition feed(s) from the previous snapshot: ${vehicleFeeds.failures.join('; ')}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `GTFS-RT refresh failed, keeping previous snapshot: ${(err as Error).message}`,
      );
    }
  }

  private tripUpdatesBackedOff(now: number = Date.now()): boolean {
    return (
      this.tripUpdateBackoffUntil !== null && now < this.tripUpdateBackoffUntil
    );
  }

  // Exponential backoff, capped. TaM answers 429 on TripUpdate.pb for minutes
  // at a time; retrying every 30s through that only extends the throttle and
  // fills the log with one line per cycle. Logged once per new backoff window
  // rather than per attempt.
  private noteTripUpdateFailure(failures: string[]): void {
    this.tripUpdateFailures += 1;
    const delay = Math.min(
      TRIP_UPDATE_BACKOFF_BASE_MS * 2 ** (this.tripUpdateFailures - 1),
      TRIP_UPDATE_BACKOFF_MAX_MS,
    );
    this.tripUpdateBackoffUntil = Date.now() + delay;
    this.logger.warn(
      `GTFS-RT TripUpdate unavailable (${failures.length} feed(s)), backing off ${Math.round(delay / 1000)}s: ${failures.join('; ')}`,
    );
  }

  @Interval(ALERT_POLL_INTERVAL_MS)
  async refreshAlerts(): Promise<void> {
    // fetchFeeds, not Promise.all: TaM throttles the two networks
    // independently, and one 429 on Urbain used to discard Suburbain's
    // disruptions along with it.
    const { entities, failures } = await this.fetchFeeds(this.alertUrls);

    // Every feed failed: keep the previous list rather than replacing it with
    // an empty one that would read as "nothing is disrupted".
    if (failures.length > 0 && entities.length === 0) {
      this.logger.error(
        `GTFS-RT alert refresh failed, keeping ${this.alerts.length} previous alert(s): ${failures.join('; ')}`,
      );
      return;
    }

    const rawAlerts = entities.flatMap(toServiceAlerts);
    const routeShortNames = await this.scheduleRepository.findRouteShortNames(
      Array.from(new Set(rawAlerts.flatMap((a) => a.routeIds))),
    );

    const previousCount = this.alerts.length;
    this.alerts = rawAlerts.map((alert) => ({
      ...alert,
      routeShortNames: alert.routeIds.map(
        (id) => routeShortNames.get(id) ?? id,
      ),
    }));
    // The live snapshot must see the new list without waiting for the next
    // refresh — otherwise a just-published disruption stays invisible.
    if (this.snapshot) {
      this.snapshot = { ...this.snapshot, alerts: this.alerts };
    }

    if (failures.length > 0) {
      this.logger.warn(
        `GTFS-RT alert partial refresh, ${failures.length} feed(s) unavailable: ${failures.join('; ')}`,
      );
    }

    // Logged on change only. A line every 5 minutes saying the same number
    // would be noise; without any line at all, an empty feed and a silently
    // broken parse look identical from the outside — which is exactly the
    // question "why do I never see an alert?" could not answer.
    if (this.alerts.length !== previousCount) {
      this.logger.log(
        `GTFS-RT alerts: ${this.alerts.length} published (was ${previousCount})`,
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
  // activePeriod.
  //
  // Read from this.alerts, NOT from the snapshot, and deliberately not gated on
  // isFresh(): that measures the vehicle/delay snapshot, which TaM throttles
  // independently. One 429 on VehiclePosition.pb used to turn every live
  // disruption into "no disruption" — a stale-position problem reported as a
  // calm network, which is worse than saying nothing. Alerts carry their own
  // activePeriod and are filtered on it below, so an expired one cannot show
  // through however old the list is.
  getActiveAlerts(now: Date = new Date()): ServiceAlert[] {
    return this.alerts.filter(
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
// Measured 2026-08-29 against the real feed and a full GTFS import: 0/38 RT
// tripIds matched as published, 36/38 after stripping a trailing `-\d+`. A TaM
// producer quirk, not a GTFS-RT rule, so it is normalised here at the feed
// boundary rather than in SQL, which holds the canonical value.
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
      // Only `delay` is read, never the absolute epoch `time`: deriving a delay
      // from it needs the static stop_time, which lives in Postgres. To support
      // it, subtract in BusTramMobilityProvider where that row is already held.
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
): Omit<ServiceAlert, 'routeShortNames'>[] {
  return entities
    .filter((entity) => entity.alert)
    .map((entity) => {
      const alert = entity.alert!;
      // Only the first activePeriod is kept. GTFS-RT allows several (a
      // recurring disruption); one covers TaM's feed. To support more, keep the
      // array and test it with some().
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
