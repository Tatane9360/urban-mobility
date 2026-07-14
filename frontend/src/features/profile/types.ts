import { TransportMode } from '../journey-planner/types';

// Mirrors backend/src/profile/dto/profile-response.dto.ts
export interface Profile {
  preferredModes: TransportMode[];
  favoriteAddresses: string[];
  pmrAccessibility: boolean;
}

// Mirrors backend/src/profile/dto/update-profile.dto.ts
export interface UpdateProfileRequest {
  preferredModes?: TransportMode[];
  favoriteAddresses?: string[];
  pmrAccessibility?: boolean;
}

export { TransportMode };
