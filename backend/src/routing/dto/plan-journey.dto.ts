import { Type } from 'class-transformer';
import { IsDate, IsOptional, ValidateNested } from 'class-validator';
import { JourneyPointDto } from './journey-point.dto';

export class PlanJourneyDto {
  @ValidateNested()
  @Type(() => JourneyPointDto)
  origin: JourneyPointDto;

  @ValidateNested()
  @Type(() => JourneyPointDto)
  destination: JourneyPointDto;

  // ponytail: optional, defaults to "now" in the controller — lets tests (and
  // real users planning ahead) pin a departure time instead of always meaning
  // "leaving right now".
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  departureTime?: Date;
}
