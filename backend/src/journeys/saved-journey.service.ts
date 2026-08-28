import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedJourney } from './entities/saved-journey.entity';
import { SavedJourneySegment } from './entities/saved-journey-segment.entity';
import { SaveJourneyDto } from './dto/save-journey.dto';
import { SavedJourneyResponseDto } from './dto/saved-journey-response.dto';
import {
  SavedJourneyModeStats,
  SavedJourneyStatsDto,
} from './dto/saved-journey-stats.dto';
import { CarbonService } from '../carbon/carbon.service';
import { TransportMode } from '../common/transport-mode.enum';

// Shape of one GROUP BY mode row — Postgres returns SUM/COUNT as strings.
interface ModeRow {
  mode: TransportMode;
  segmentCount: string;
  durationSeconds: string | null;
  distanceMeters: string | null;
  carbonGrams: string | null;
}

@Injectable()
export class SavedJourneyService {
  constructor(
    @InjectRepository(SavedJourney)
    private readonly savedJourneyRepository: Repository<SavedJourney>,
    @InjectRepository(SavedJourneySegment)
    private readonly savedJourneySegmentRepository: Repository<SavedJourneySegment>,
    private readonly carbonService: CarbonService,
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
    return journeys.map((journey) =>
      SavedJourneyResponseDto.fromEntity(journey),
    );
  }

  async deleteForUser(userId: string, journeyId: string): Promise<void> {
    // 404 rather than 403 on someone else's Journey: a 403 would confirm the
    // id exists. Segments go with it via saved_journey_segment's
    // onDelete: 'CASCADE'.
    const result = await this.savedJourneyRepository.delete({
      id: journeyId,
      userDbId: userId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Saved Journey not found');
    }
  }

  // SQL aggregation, no new table: one GROUP BY over the user's segments.
  // Journey-level totals are summed from the same rows client-side rather
  // than issued as a second query — a user's saved history is a handful of
  // modes (4 at most, one row each), so there is nothing to page over.
  async statsForUser(
    userId: string,
    from?: Date,
    to?: Date,
  ): Promise<SavedJourneyStatsDto> {
    const query = this.savedJourneySegmentRepository
      .createQueryBuilder('segment')
      .innerJoin('segment.journey', 'journey')
      .select('segment.mode', 'mode')
      .addSelect('COUNT(*)', 'segmentCount')
      .addSelect('SUM(segment.durationSeconds)', 'durationSeconds')
      .addSelect('SUM(segment.distanceMeters)', 'distanceMeters')
      .addSelect('SUM(segment.carbonGrams)', 'carbonGrams')
      .where('journey.userDbId = :userId', { userId })
      .groupBy('segment.mode');

    // Parameterised, never interpolated — these come straight from the query
    // string. savedAt is timestamptz, so the bounds are compared in UTC.
    if (from) query.andWhere('journey.savedAt >= :from', { from });
    if (to) query.andWhere('journey.savedAt <= :to', { to });

    const rows = await query.getRawMany<ModeRow>();

    const byMode: SavedJourneyModeStats[] = rows.map((row) => ({
      mode: row.mode,
      journeySegments: Number(row.segmentCount),
      durationSeconds: Number(row.durationSeconds ?? 0),
      distanceMeters: Number(row.distanceMeters ?? 0),
      carbonGrams: Number(row.carbonGrams ?? 0),
    }));

    const durationSeconds = sum(byMode, (m) => m.durationSeconds);
    const distanceMeters = sum(byMode, (m) => m.distanceMeters);
    const carbonGrams = sum(byMode, (m) => m.carbonGrams);

    // Reuses CarbonService rather than re-deriving the car baseline here: it
    // only reads distanceMeters and carbonGrams off the segments, so the
    // period's totals stand in as a single equivalent segment. Its
    // carCarbonGrams === 0 branch is what keeps savedPercent out of NaN when
    // the user has saved nothing.
    const comparison = this.carbonService.carComparison(
      [{ distanceMeters }],
      carbonGrams,
    );

    return {
      journeyCount: await this.countJourneys(userId, from, to),
      durationSeconds,
      distanceMeters,
      carbonGrams,
      ...comparison,
      byMode,
    };
  }

  private countJourneys(
    userId: string,
    from?: Date,
    to?: Date,
  ): Promise<number> {
    const query = this.savedJourneyRepository
      .createQueryBuilder('journey')
      .where('journey.userDbId = :userId', { userId });
    if (from) query.andWhere('journey.savedAt >= :from', { from });
    if (to) query.andWhere('journey.savedAt <= :to', { to });
    return query.getCount();
  }

  private toSegmentEntity(
    segment: SaveJourneyDto['segments'][number],
    order: number,
  ): SavedJourneySegment {
    return this.savedJourneySegmentRepository.create({
      order,
      mode: segment.mode,
      durationSeconds: segment.durationSeconds,
      distanceMeters: segment.distanceMeters ?? 0,
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

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}
