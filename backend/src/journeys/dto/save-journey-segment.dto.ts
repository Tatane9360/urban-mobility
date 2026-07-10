import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
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
