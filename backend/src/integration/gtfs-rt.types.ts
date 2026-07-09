export interface VehiclePosition {
  vehicleId: string;
  tripId: string | null;
  routeId: string | null;
  lat: number;
  lon: number;
  bearing: number | null;
  speed: number | null;
  timestamp: Date;
}

export interface GtfsRtSnapshot {
  vehicles: VehiclePosition[];
  fetchedAt: Date;
}
