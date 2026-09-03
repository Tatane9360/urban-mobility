import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { TransportMode } from '../../common/transport-mode.enum';
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

  // Defaults to now in the controller when omitted.
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

  // Restricts which providers are called — the caller explicitly asking for a
  // subset. The Mobility Profile does NOT filter: an authenticated user's
  // preferredModes only ranks the candidates (see
  // JourneyPlannerService.sortJourneys), so a preference never hides an
  // option.
  @ApiPropertyOptional({
    description:
      'Transport modes to consider. Defaults to every mode; a profile preference ranks results rather than filtering them.',
    enum: TransportMode,
    isArray: true,
    example: [TransportMode.Tram, TransportMode.Marche],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TransportMode, { each: true })
  modes?: TransportMode[];
}
