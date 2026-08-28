import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CarbonModule } from '../carbon/carbon.module';
import { SavedJourney } from './entities/saved-journey.entity';
import { SavedJourneySegment } from './entities/saved-journey-segment.entity';
import { SavedJourneysController } from './saved-journeys.controller';
import { SavedJourneyService } from './saved-journey.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SavedJourney, SavedJourneySegment]),
    AuthModule,
    CarbonModule,
  ],
  controllers: [SavedJourneysController],
  providers: [SavedJourneyService],
})
export class JourneysModule {}
