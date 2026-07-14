import { TransportMode, type JourneySegment, type JourneyWaypoint, type Coordinates } from './types';

// A single entry in the "Démarrer l'itinéraire" walkthrough. Bus/Tram
// segments (and any Marche/Vélo segment ORS failed to enrich) become one
// NavStep summarizing the whole segment — there's no finer-grained turn data
// for them, so the map frames the segment's full from/to. Marche/Vélo
// segments with `steps` expand into one NavStep per ORS instruction, each
// framed on its own maneuver location (see OrsStep.location) rather than the
// whole segment — a 3km walk with 40 turns needs to zoom turn by turn.
export interface NavStep {
  instruction: string;
  distanceMeters: number;
  mode: TransportMode;
  bounds: [Coordinates, Coordinates];
  // Where the "you are here" marker sits for this step — the step's start,
  // not its maneuver point, so the marker reads as "approaching the turn"
  // rather than "already past it". Same value as bounds[0], named for what
  // it means at the call site rather than its position in the tuple.
  currentPosition: Coordinates;
  routeShortName?: string | null;
  tripHeadsign?: string | null;
}

function summaryInstruction(segment: JourneySegment): string {
  if (segment.mode === TransportMode.Tram || segment.mode === TransportMode.Bus) {
    const line = segment.routeShortName ? ` ${segment.routeShortName}` : '';
    return `Prenez le ${segment.mode}${line}${segment.tripHeadsign ? ` en direction de ${segment.tripHeadsign}` : ''}`;
  }
  return `${segment.mode} de ${segment.from.name || 'votre position'} à ${segment.to.name || 'votre destination'}`;
}

function segmentBounds(segment: JourneySegment): [JourneyWaypoint, JourneyWaypoint] {
  return [segment.from, segment.to];
}

export function buildNavigationSteps(segments: JourneySegment[]): NavStep[] {
  return segments.flatMap((segment): NavStep[] => {
    if (!segment.steps || segment.steps.length === 0) {
      return [
        {
          instruction: summaryInstruction(segment),
          distanceMeters: segment.distanceMeters,
          mode: segment.mode,
          bounds: segmentBounds(segment),
          currentPosition: segment.from,
          routeShortName: segment.routeShortName,
          tripHeadsign: segment.tripHeadsign,
        },
      ];
    }

    let previousLocation: Coordinates = segment.from;
    return segment.steps.map((step) => {
      const bounds: [Coordinates, Coordinates] = [previousLocation, step.location];
      const currentPosition = previousLocation;
      previousLocation = step.location;
      return {
        instruction: step.instruction,
        distanceMeters: step.distanceMeters,
        mode: segment.mode,
        bounds,
        currentPosition,
      };
    });
  });
}
