import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { SaveJourneySegmentDto } from './save-journey-segment.dto';

// The client saves the exact Journey it already received from POST /journeys
// (#12/#13) — no recomputation here, this endpoint is a persistence layer
// only (see ADR 0001).
export class SaveJourneyDto {
  @ValidateNested({ each: true })
  @Type(() => SaveJourneySegmentDto)
  @ArrayMinSize(1)
  segments: SaveJourneySegmentDto[];

  @IsNumber()
  @Min(0)
  durationSeconds: number;

  @IsNumber()
  @Min(0)
  carbonGrams: number;

  @IsBoolean()
  degraded: boolean;
}
