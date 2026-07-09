import { TransportMode } from '../../auth/transport-mode.enum';
import { MobilityProfile } from '../../auth/entities/mobility-profile.entity';

// ponytail: constructor takes this narrow shape, not MobilityProfile itself,
// so it can only ever copy these 3 fields — a future `Object.assign(this,
// profile)` "simplification" would fail to typecheck instead of silently
// leaking User fields (passwordHash) through the `user` relation.
interface ProfileFields {
  preferredModes: TransportMode[];
  favoriteAddresses: string[];
  pmrAccessibility: boolean;
}

export class ProfileResponseDto {
  preferredModes: TransportMode[];
  favoriteAddresses: string[];
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
