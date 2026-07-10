import { Body, Controller, Post } from '@nestjs/common';
import { Journey } from './journey';
import { JourneyPlannerService } from './journey-planner.service';
import { PlanJourneyDto } from './dto/plan-journey.dto';

@Controller('journeys')
export class JourneysController {
  constructor(private readonly plannerService: JourneyPlannerService) {}

  @Post()
  plan(@Body() dto: PlanJourneyDto): Promise<Journey[]> {
    return this.plannerService.plan(dto, dto.departureTime ?? new Date());
  }
}
