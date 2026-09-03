import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GbfsService } from './gbfs.service';
import { GbfsStation, GbfsStationStatus } from './gbfs.types';

interface BikeStationsResponse {
  // When the underlying GBFS snapshot was last refreshed successfully — null
  // until the first poll ever succeeds. One timestamp for the whole snapshot,
  // not per station: GbfsService.refresh() replaces it atomically.
  fetchedAt: string | null;
  stations: (GbfsStation & Partial<GbfsStationStatus>)[];
}

// Public on purpose, same reasoning as AlertsController: a guest looking for
// a bike shouldn't have to sign in first.
@ApiTags('gbfs')
@Controller('bike-stations')
export class GbfsController {
  constructor(private readonly gbfsService: GbfsService) {}

  @ApiOperation({ summary: 'Bike-share stations with their live availability' })
  @ApiResponse({
    status: 200,
    description:
      "Stations with current status and the snapshot's fetch time, empty until the first successful GBFS poll",
  })
  @Get()
  current(): BikeStationsResponse {
    const snapshot = this.gbfsService.getSnapshot();
    if (!snapshot) return { fetchedAt: null, stations: [] };
    return {
      fetchedAt: snapshot.fetchedAt.toISOString(),
      stations: snapshot.stations.map((station) => ({
        ...station,
        ...snapshot.statusByStationId.get(station.stationId),
      })),
    };
  }
}
