import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Journey } from './journey';
import { JourneyPlannerService } from './journey-planner.service';
import { PlanJourneyDto } from './dto/plan-journey.dto';

@ApiTags('journeys')
@Controller('journeys')
export class JourneysController {
  constructor(private readonly plannerService: JourneyPlannerService) {}

  @ApiOperation({
    summary:
      'Plan Journeys between an origin and a destination, sorted by duration or carbon footprint',
  })
  @ApiResponse({
    status: 201,
    description: 'Candidate Journeys, sorted per the requested criterion',
  })
  @Post()
  plan(@Body() dto: PlanJourneyDto): Promise<Journey[]> {
    return this.plannerService.plan(dto, dto.departureTime ?? new Date());
  }
}
