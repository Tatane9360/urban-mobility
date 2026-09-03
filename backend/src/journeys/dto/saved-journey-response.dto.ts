import { TransportMode } from '../../common/transport-mode.enum';
import { SavedJourney } from '../entities/saved-journey.entity';

interface SavedJourneySegmentFields {
  mode: TransportMode;
  durationSeconds: number;
  carbonGrams: number;
  from: { name: string; lat: number; lon: number };
  to: { name: string; lat: number; lon: number };
}

export class SavedJourneySegmentResponseDto {
  mode: TransportMode;
  durationSeconds: number;
  carbonGrams: number;
  from: { name: string; lat: number; lon: number };
  to: { name: string; lat: number; lon: number };

  private constructor(fields: SavedJourneySegmentFields) {
    this.mode = fields.mode;
    this.durationSeconds = fields.durationSeconds;
    this.carbonGrams = fields.carbonGrams;
    this.from = fields.from;
    this.to = fields.to;
  }

  static fromEntity(segment: {
    mode: TransportMode;
    durationSeconds: number;
    carbonGrams: number;
    fromName: string;
    fromLat: number;
    fromLon: number;
    toName: string;
    toLat: number;
    toLon: number;
  }): SavedJourneySegmentResponseDto {
    return new SavedJourneySegmentResponseDto({
      mode: segment.mode,
      durationSeconds: segment.durationSeconds,
      carbonGrams: segment.carbonGrams,
      from: {
        name: segment.fromName,
        lat: segment.fromLat,
        lon: segment.fromLon,
      },
      to: { name: segment.toName, lat: segment.toLat, lon: segment.toLon },
    });
  }
}

interface SavedJourneyFields {
  id: string;
  segments: SavedJourneySegmentResponseDto[];
  durationSeconds: number;
  carbonGrams: number;
  degraded: boolean;
  savedAt: Date;
}

// Narrow constructor shape, not the SavedJourney entity: keeps the response
// pinned to these fields even if the entity grows a user relation. Same
// pattern as profile-response.dto.ts.
export class SavedJourneyResponseDto {
  id: string;
  segments: SavedJourneySegmentResponseDto[];
  durationSeconds: number;
  carbonGrams: number;
  degraded: boolean;
  savedAt: Date;

  private constructor(fields: SavedJourneyFields) {
    this.id = fields.id;
    this.segments = fields.segments;
    this.durationSeconds = fields.durationSeconds;
    this.carbonGrams = fields.carbonGrams;
    this.degraded = fields.degraded;
    this.savedAt = fields.savedAt;
  }

  static fromEntity(journey: SavedJourney): SavedJourneyResponseDto {
    return new SavedJourneyResponseDto({
      id: journey.id,
      segments: [...journey.segments]
        .sort((a, b) => a.order - b.order)
        .map((segment) => SavedJourneySegmentResponseDto.fromEntity(segment)),
      durationSeconds: journey.durationSeconds,
      carbonGrams: journey.carbonGrams,
      degraded: journey.degraded,
      savedAt: journey.savedAt,
    });
  }
}
