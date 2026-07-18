import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { JourneyPointDto } from './journey-point.dto';

export type JourneySortCriterion = 'duration' | 'carbon';

export class PlanJourneyDto {
  @ApiProperty({
    description: 'Origin point, as coordinates or a free-text address',
    type: JourneyPointDto,
  })
  @ValidateNested()
  @Type(() => JourneyPointDto)
  origin: JourneyPointDto;

  @ApiProperty({
    description: 'Destination point, as coordinates or a free-text address',
    type: JourneyPointDto,
  })
  @ValidateNested()
  @Type(() => JourneyPointDto)
  destination: JourneyPointDto;

  // ponytail: optional, defaults to "now" in the controller — lets tests (and
  // real users planning ahead) pin a departure time instead of always meaning
  // "leaving right now".
  @ApiPropertyOptional({
    description: 'Departure time, defaults to now',
    example: '2026-07-18T08:00:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  departureTime?: Date;

  // Sorts the already-computed Journey candidates — no recomputation, no
  // second call to any MobilityProvider (see CONTEXT.md, "Tri des résultats").
  @ApiPropertyOptional({
    description:
      'Sort criterion for the candidate Journeys, defaults to duration',
    enum: ['duration', 'carbon'],
    example: 'duration',
  })
  @IsOptional()
  @IsIn(['duration', 'carbon'])
  sort?: JourneySortCriterion;
}
