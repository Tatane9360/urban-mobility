import { Injectable } from '@nestjs/common';
import { TransportMode } from '../common/transport-mode.enum';
import { GeoPoint } from './geo-point';
import { haversineDistanceMeters } from './geo-distance';
import { GtfsRtService } from '../integration/gtfs-rt.service';
import { GtfsScheduleRepository } from '../integration/gtfs-schedule.repository';
import { tripStopKey } from '../integration/gtfs-rt.types';
import { Ride } from '../integration/ride';
import { RawJourneySegment } from './journey-segment';
import { MobilityProvider } from './mobility-provider';

@Injectable()
export class BusTramMobilityProvider implements MobilityProvider {
  readonly modes = [TransportMode.Tram, TransportMode.Bus] as const;

  constructor(
    private readonly scheduleRepository: GtfsScheduleRepository,
    private readonly gtfsRtService: GtfsRtService,
  ) {}

  // Each departure is a Journey in its own right — the repository returns the
  // next few on possibly different lines, and a rider picks between them.
  //
  // The mode filter is applied here, after the query rather than before it:
  // Tram and Bus come from one SQL pass, so asking for only one of them still
  // returns both and the unwanted mode is dropped from the result.
  async proposeJourneys(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
    wanted: (mode: TransportMode) => boolean,
  ): Promise<RawJourneySegment[][]> {
    if (!this.modes.some(wanted)) return [];
    const segments = await this.getSegments(from, to, departureTime);
    return segments.filter((s) => wanted(s.mode)).map((segment) => [segment]);
  }

  async getSegments(
    from: GeoPoint,
    to: GeoPoint,
    departureTime: Date,
  ): Promise<RawJourneySegment[]> {
    const rides = await this.scheduleRepository.findRides(
      from,
      to,
      departureTime,
    );

    // Only a fresh GTFS-RT snapshot may shift a schedule; a stale one is
    // served as pure theory (see GtfsRtService.isFresh). Freshness is measured
    // against the wall clock, deliberately NOT against departureTime — the
    // latter is the itinerary's date, which a user can set weeks ahead, and
    // comparing a snapshot's age to it would read as "fresh" for any future
    // search.
    const delays = this.gtfsRtService.isFresh()
      ? this.gtfsRtService.getSnapshot()!.delays
      : null;

    return rides.map((ride) =>
      toSegment(
        ride,
        departureTime,
        (stopId) =>
          delays?.get(tripStopKey(ride.tripId, stopId))?.delaySeconds ?? null,
      ),
    );
  }
}

// The theoretical ride plus whatever GTFS-RT knows about it, as a Journey
// Segment. `delayAt` returns the published delay for a stop of this ride, or
// null when the feed says nothing — a pure function of the ride, so the delay
// rules below are testable without a database.
export function toSegment(
  ride: Ride,
  departureTime: Date,
  delayAt: (stopId: string) => number | null,
): RawJourneySegment {
  const from = {
    name: ride.boarding.name,
    lat: ride.boarding.lat,
    lon: ride.boarding.lon,
  };
  const to = {
    name: ride.alighting.name,
    lat: ride.alighting.lat,
    lon: ride.alighting.lon,
  };

  const departureDelay = delayAt(ride.boarding.stopId);
  const arrivalDelay =
    delayAt(ride.alighting.stopId) ??
    // A trip delayed at boarding but with no update at the alighting stop
    // is still late on arrival — carry the departure delay forward rather
    // than inventing a miraculous catch-up.
    departureDelay;
  const realtime = departureDelay !== null || arrivalDelay !== null;

  return {
    mode: ride.isTram ? TransportMode.Tram : TransportMode.Bus,
    durationSeconds:
      ride.scheduledArrivalSeconds +
      (arrivalDelay ?? 0) -
      (ride.scheduledDepartureSeconds + (departureDelay ?? 0)),
    // Straight-line between the matched stops, not the line's real
    // alignment: GTFS carries no per-segment distance and ORS has no
    // "follow this transit line" profile.
    distanceMeters: haversineDistanceMeters(from, to),
    from,
    to,
    routeShortName: ride.routeShortName,
    tripHeadsign: ride.tripHeadsign,
    routeId: ride.routeId,
    realtime,
    // The delay a rider actually experiences: how much later they board.
    delaySeconds: departureDelay ?? 0,
    // The stops this ride actually serves between boarding and alighting.
    // Not the rail/road alignment — TaM's GTFS ships no shapes.txt — but a
    // line through the served stops follows the route far more closely
    // than a single chord, and needs no extra data source.
    geometry: ride.servedStops,
    // The real boarding time of THIS departure, so several alternatives on
    // one line stay distinguishable. Built on departureTime's own calendar
    // day, matching the day the calendar filter selected.
    scheduledDeparture: atTimeOfDay(
      departureTime,
      ride.scheduledDepartureSeconds + (departureDelay ?? 0),
    ),
  };
}

// Wall-clock instant for a time-of-day on `date`'s own calendar day. Seconds
// past midnight, so GTFS's >24:00:00 overnight convention rolls into the next
// day on its own rather than being clamped.
function atTimeOfDay(date: Date, secondsSinceMidnight: number): Date {
  const midnight = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  return new Date(midnight.getTime() + secondsSinceMidnight * 1000);
}
