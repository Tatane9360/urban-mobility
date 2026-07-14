export interface OrsStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  // ORS's own maneuver type code (0 = left, 1 = right, 11 = head straight, ...) —
  // passed through as-is, the frontend maps it to an icon.
  type: number;
  // Where this step ends along the route, so the frontend can zoom the map
  // to the actual maneuver point instead of the whole segment's from/to.
  location: { lat: number; lon: number };
}

export interface OrsRoute {
  distanceMeters: number;
  durationSeconds: number;
  steps: OrsStep[];
  // The route's actual road/path geometry, in travel order — draws the real
  // tracé on the map instead of a straight line between from/to.
  geometry: Array<{ lat: number; lon: number }>;
}

export type OrsProfile = 'foot-walking' | 'cycling-regular';
