import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedJourney } from './entities/saved-journey.entity';
import { SavedJourneySegment } from './entities/saved-journey-segment.entity';
import { SaveJourneyDto } from './dto/save-journey.dto';
import { SavedJourneyResponseDto } from './dto/saved-journey-response.dto';

@Injectable()
export class SavedJourneyService {
  constructor(
    @InjectRepository(SavedJourney)
    private readonly savedJourneyRepository: Repository<SavedJourney>,
    @InjectRepository(SavedJourneySegment)
    private readonly savedJourneySegmentRepository: Repository<SavedJourneySegment>,
  ) {}

  async saveForUser(
    userId: string,
    dto: SaveJourneyDto,
  ): Promise<SavedJourneyResponseDto> {
    const journey = this.savedJourneyRepository.create({
      userDbId: userId,
      durationSeconds: dto.durationSeconds,
      carbonGrams: dto.carbonGrams,
      degraded: dto.degraded,
      segments: dto.segments.map((segment, index) =>
        this.toSegmentEntity(segment, index),
      ),
    });

    const saved = await this.savedJourneyRepository.save(journey);
    return SavedJourneyResponseDto.fromEntity(saved);
  }

  async listForUser(userId: string): Promise<SavedJourneyResponseDto[]> {
    const journeys = await this.savedJourneyRepository.find({
      where: { userDbId: userId },
      relations: { segments: true },
      order: { savedAt: 'DESC' },
    });
    return journeys.map((journey) => SavedJourneyResponseDto.fromEntity(journey));
  }

  private toSegmentEntity(
    segment: SaveJourneyDto['segments'][number],
    order: number,
  ): SavedJourneySegment {
    return this.savedJourneySegmentRepository.create({
      order,
      mode: segment.mode,
      durationSeconds: segment.durationSeconds,
      carbonGrams: segment.carbonGrams,
      fromName: segment.from.name,
      fromLat: segment.from.lat,
      fromLon: segment.from.lon,
      toName: segment.to.name,
      toLat: segment.to.lat,
      toLon: segment.to.lon,
    });
  }
}
