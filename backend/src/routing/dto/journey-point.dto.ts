import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class CoordinatesDto {
  @ApiPropertyOptional({ description: 'Latitude', example: 43.6 })
  @IsLatitude()
  lat: number;

  @ApiPropertyOptional({ description: 'Longitude', example: 3.87 })
  @IsLongitude()
  lon: number;
}

// Either coordinates or a free-text address. Exactly one must be present —
// enforced in JourneyPlannerService, not by a custom validator, since it is a
// one-line check at a single call site.
export class JourneyPointDto {
  @ApiPropertyOptional({
    description: 'Coordinates, mutually exclusive with address',
    type: CoordinatesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  @ApiPropertyOptional({
    description:
      'Free-text address, geocoded server-side, mutually exclusive with coordinates',
    example: 'Place de la Comédie, Montpellier',
  })
  @IsOptional()
  @IsString()
  address?: string;
}
