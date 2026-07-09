import { TransportMode } from '../../auth/transport-mode.enum';
import { MobilityProfile } from '../../auth/entities/mobility-profile.entity';

export class ProfileResponseDto {
  preferredModes: TransportMode[];
  favoriteAddresses: string[];
  pmrAccessibility: boolean;

  private constructor(profile: MobilityProfile) {
    this.preferredModes = profile.preferredModes as TransportMode[];
    this.favoriteAddresses = profile.favoriteAddresses;
    this.pmrAccessibility = profile.pmrAccessibility;
  }

  static fromEntity(profile: MobilityProfile): ProfileResponseDto {
    return new ProfileResponseDto(profile);
  }
}
