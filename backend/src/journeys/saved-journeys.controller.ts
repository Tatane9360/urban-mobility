import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SaveJourneyDto } from './dto/save-journey.dto';
import { SavedJourneyResponseDto } from './dto/saved-journey-response.dto';
import { SavedJourneyService } from './saved-journey.service';

@UseGuards(JwtAuthGuard)
@Controller('journeys/saved')
export class SavedJourneysController {
  constructor(private readonly savedJourneyService: SavedJourneyService) {}

  @Post()
  save(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SaveJourneyDto,
  ): Promise<SavedJourneyResponseDto> {
    return this.savedJourneyService.saveForUser(request.userId, dto);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
  ): Promise<SavedJourneyResponseDto[]> {
    return this.savedJourneyService.listForUser(request.userId);
  }
}
