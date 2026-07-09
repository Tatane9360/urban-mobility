import { Module } from '@nestjs/common';
import { IntegrationModule } from '../integration/integration.module';
import { BusTramMobilityProvider } from './bus-tram.mobility-provider';
import { WalkMobilityProvider } from './walk.mobility-provider';
import { BikeMobilityProvider } from './bike.mobility-provider';

@Module({
  imports: [IntegrationModule],
  providers: [
    BusTramMobilityProvider,
    WalkMobilityProvider,
    BikeMobilityProvider,
  ],
  exports: [
    BusTramMobilityProvider,
    WalkMobilityProvider,
    BikeMobilityProvider,
  ],
})
export class RoutingModule {}
