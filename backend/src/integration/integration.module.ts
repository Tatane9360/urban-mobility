import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GtfsAgency } from './entities/gtfs-agency.entity';
import { GtfsRoute } from './entities/gtfs-route.entity';
import { GtfsImportService } from './gtfs-import.service';

@Module({
  imports: [TypeOrmModule.forFeature([GtfsAgency, GtfsRoute])],
  providers: [GtfsImportService],
  exports: [GtfsImportService],
})
export class IntegrationModule {}
