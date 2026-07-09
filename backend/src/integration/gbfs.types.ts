export interface GbfsStation {
  stationId: string;
  name: string;
  lat: number;
  lon: number;
}

export interface GbfsStationStatus {
  stationId: string;
  bikesAvailable: number;
  docksAvailable: number;
  isRenting: boolean;
}

export interface GbfsSnapshot {
  stations: GbfsStation[];
  statusByStationId: Map<string, GbfsStationStatus>;
  fetchedAt: Date;
}
