import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TransportMode } from '../../common/transport-mode.enum';

class WaypointDto {
  @IsString()
  name: string;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lon: number;
}

export class SaveJourneySegmentDto {
  @IsEnum(TransportMode)
  mode: TransportMode;

  @IsNumber()
  @Min(0)
  durationSeconds: number;

  // Optional: pre-existing clients (and rows saved before this field existed)
  // omit it. Missing distance just means that Journey contributes 0 km to the
  // car baseline in GET /journeys/saved/stats, never a wrong total.
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceMeters?: number;

  @IsNumber()
  @Min(0)
  carbonGrams: number;

  @ValidateNested()
  @Type(() => WaypointDto)
  from: WaypointDto;

  @ValidateNested()
  @Type(() => WaypointDto)
  to: WaypointDto;
}
