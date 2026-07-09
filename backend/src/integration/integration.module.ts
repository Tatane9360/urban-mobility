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
  providers: [GtfsImportService, GbfsService],
  exports: [GtfsImportService, GbfsService],
})
export class IntegrationModule {}
