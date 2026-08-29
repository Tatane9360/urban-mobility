import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import type { OptionallyAuthenticatedRequest } from '../auth/optional-jwt.guard';
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
  // Optionally authenticated: guests keep the anonymous search F1 guarantees,
  // while a bearer token lets the profile's preferred modes apply by default.
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  plan(
    @Body() dto: PlanJourneyDto,
    @Req() request: OptionallyAuthenticatedRequest,
  ): Promise<Journey[]> {
    return this.plannerService.plan(
      dto,
      dto.departureTime ?? new Date(),
      request.userId,
    );
  }
}
