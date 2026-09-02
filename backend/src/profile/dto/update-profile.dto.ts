import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TransportMode } from '../../common/transport-mode.enum';

export class FavoriteAddressDto {
  @ApiPropertyOptional({ description: 'Short name the user picked', example: 'Maison' })
  @IsString()
  label!: string;

  @ApiPropertyOptional({
    description: 'The address itself',
    example: 'Place de la Comédie, Montpellier',
  })
  @IsString()
  @MinLength(1)
  address!: string;
}

// Accounts that saved favorites before this DTO existed still carry plain
// strings in the jsonb column (see MobilityProfile.favoriteAddresses). A
// PATCH that edits one favorite must not 400 on every legacy sibling still
// sitting in the array — each string upgrades in place to {label: '',
// address}, same shape a plain address entry from that era actually meant.
function upgradeLegacyEntry(entry: unknown): unknown {
  return typeof entry === 'string' ? { label: '', address: entry } : entry;
}

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
    description: 'Favorite addresses, each with a short user-chosen label',
    type: [FavoriteAddressDto],
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((entry) => Object.assign(new FavoriteAddressDto(), upgradeLegacyEntry(entry)))
      : value,
  )
  @ValidateNested({ each: true })
  favoriteAddresses?: FavoriteAddressDto[];

  @ApiPropertyOptional({
    description: 'PMR (reduced mobility) accessibility flag',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  pmrAccessibility?: boolean;
}
