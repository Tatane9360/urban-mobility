import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { TransportMode } from '../../common/transport-mode.enum';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Preferred Transport Modes',
    enum: TransportMode,
    isArray: true,
    example: [TransportMode.Tram, TransportMode.Velo],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TransportMode, { each: true })
  preferredModes?: TransportMode[];

  @ApiPropertyOptional({
    description: 'Favorite addresses',
    example: ['Place de la Comédie, Montpellier'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favoriteAddresses?: string[];

  @ApiPropertyOptional({
    description: 'PMR (reduced mobility) accessibility flag',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  pmrAccessibility?: boolean;
}
