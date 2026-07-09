import { Module } from '@nestjs/common';
import { BusTramMobilityProvider } from './bus-tram.mobility-provider';

@Module({
  providers: [BusTramMobilityProvider],
  exports: [BusTramMobilityProvider],
})
export class RoutingModule {}
