import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { TransportMode } from '../../auth/transport-mode.enum';

export class UpdateProfileDto {
  @IsOptional()
  @IsArray()
  @IsEnum(TransportMode, { each: true })
  preferredModes?: TransportMode[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favoriteAddresses?: string[];

  @IsOptional()
  @IsBoolean()
  pmrAccessibility?: boolean;
}
