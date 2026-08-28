import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SaveJourneyDto } from './dto/save-journey.dto';
import { SavedJourneyResponseDto } from './dto/saved-journey-response.dto';
import { SavedJourneyStatsQueryDto } from './dto/saved-journey-stats-query.dto';
import { SavedJourneyStatsDto } from './dto/saved-journey-stats.dto';
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

  // Declared before @Get() has no bearing on matching here (the paths differ),
  // but keeps the two reads together.
  @Get('stats')
  stats(
    @Req() request: AuthenticatedRequest,
    @Query() query: SavedJourneyStatsQueryDto,
  ): Promise<SavedJourneyStatsDto> {
    return this.savedJourneyService.statsForUser(
      request.userId,
      query.from,
      query.to,
    );
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
  ): Promise<SavedJourneyResponseDto[]> {
    return this.savedJourneyService.listForUser(request.userId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Req() request: AuthenticatedRequest,
    // ponytail: ParseUUIDPipe keeps a malformed id a 400 instead of letting
    // Postgres reject the uuid cast as a 500.
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.savedJourneyService.deleteForUser(request.userId, id);
  }
}
