import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { GtfsAgency } from './entities/gtfs-agency.entity';
import { GtfsRoute } from './entities/gtfs-route.entity';
import { GtfsCalendar } from './entities/gtfs-calendar.entity';
import { GtfsStop } from './entities/gtfs-stop.entity';
import { GtfsTrip } from './entities/gtfs-trip.entity';
import { GtfsStopTime } from './entities/gtfs-stop-time.entity';
import { GtfsImportService } from './gtfs-import.service';
import { GbfsService } from './gbfs.service';
import { GtfsRtService } from './gtfs-rt.service';
import { GeocodingService } from './geocoding.service';
import { GeocodingController } from './geocoding.controller';
import { AlertsController } from './alerts.controller';
import { GbfsController } from './gbfs.controller';
import { OpenRouteService } from './openrouteservice.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      GtfsAgency,
      GtfsRoute,
      GtfsCalendar,
      GtfsStop,
      GtfsTrip,
      GtfsStopTime,
    ]),
  ],
  controllers: [GeocodingController, AlertsController, GbfsController],
  providers: [
    GtfsImportService,
    GbfsService,
    GtfsRtService,
    GeocodingService,
    OpenRouteService,
  ],
  exports: [
    GtfsImportService,
    GbfsService,
    GtfsRtService,
    GeocodingService,
    OpenRouteService,
  ],
})
export class IntegrationModule {}
