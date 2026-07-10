import { Module } from '@nestjs/common';
import { CarbonModule } from '../carbon/carbon.module';
import { IntegrationModule } from '../integration/integration.module';
import { BusTramMobilityProvider } from './bus-tram.mobility-provider';
import { WalkMobilityProvider } from './walk.mobility-provider';
import { BikeMobilityProvider } from './bike.mobility-provider';
import { JourneyPlannerService } from './journey-planner.service';
import { JourneysController } from './journeys.controller';

@Module({
  imports: [IntegrationModule, CarbonModule],
  controllers: [JourneysController],
  providers: [
    BusTramMobilityProvider,
    WalkMobilityProvider,
    BikeMobilityProvider,
    JourneyPlannerService,
  ],
  exports: [
    BusTramMobilityProvider,
    WalkMobilityProvider,
    BikeMobilityProvider,
  ],
})
export class RoutingModule {}
