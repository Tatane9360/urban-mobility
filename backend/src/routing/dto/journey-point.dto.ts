import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class CoordinatesDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lon: number;
}

// ponytail: accepts either coordinates or a free-text address (geocoded via
// #9) — exactly one must be present, enforced in JourneyPlannerService rather
// than a custom class-validator decorator, since a one-line check is simpler
// than a new validator for a single call site.
export class JourneyPointDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  @IsOptional()
  @IsString()
  address?: string;
}
