import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GtfsRtService } from './gtfs-rt.service';
import { ServiceAlert } from './gtfs-rt.types';

// Public on purpose: a guest checking whether the tram is disrupted shouldn't
// have to sign in first.
@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly gtfsRtService: GtfsRtService) {}

  @ApiOperation({
    summary: 'Current GTFS-RT service alerts (disruptions) on the TaM network',
  })
  @ApiResponse({ status: 200, description: 'Alerts active right now' })
  @Get()
  current(): ServiceAlert[] {
    return this.gtfsRtService.getActiveAlerts();
  }
}
