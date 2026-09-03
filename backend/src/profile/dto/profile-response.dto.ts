import { ApiProperty } from '@nestjs/swagger';
import { TransportMode } from '../../common/transport-mode.enum';
import { MobilityProfile } from '../../auth/entities/mobility-profile.entity';
import { FavoriteAddress } from '../favorite-address';
import { FavoriteAddressDto } from './update-profile.dto';

// The constructor takes this narrow shape, not MobilityProfile itself, so it
// can only copy these three fields. Replacing it with Object.assign(this,
// profile) would fail to typecheck rather than silently leak User fields
// (passwordHash) through the `user` relation — keep it narrow.
interface ProfileFields {
  preferredModes: TransportMode[];
  favoriteAddresses: FavoriteAddress[];
  pmrAccessibility: boolean;
}

export class ProfileResponseDto {
  @ApiProperty({
    description: 'Preferred Transport Modes',
    enum: TransportMode,
    isArray: true,
    example: [TransportMode.Tram, TransportMode.Velo],
  })
  preferredModes: TransportMode[];

  @ApiProperty({
    description: 'Favorite addresses, each with a short user-chosen label',
    type: [FavoriteAddressDto],
  })
  favoriteAddresses: FavoriteAddress[];

  @ApiProperty({
    description: 'PMR (reduced mobility) accessibility flag',
    example: false,
  })
  pmrAccessibility: boolean;

  private constructor(fields: ProfileFields) {
    this.preferredModes = fields.preferredModes;
    this.favoriteAddresses = fields.favoriteAddresses;
    this.pmrAccessibility = fields.pmrAccessibility;
  }

  static fromEntity(profile: MobilityProfile): ProfileResponseDto {
    return new ProfileResponseDto({
      preferredModes: profile.preferredModes as TransportMode[],
      favoriteAddresses: profile.favoriteAddresses,
      pmrAccessibility: profile.pmrAccessibility,
    });
  }
}
