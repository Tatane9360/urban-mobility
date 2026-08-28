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

// Mirrors backend/src/auth/dto/user-data-export.dto.ts
export interface UserDataExport {
  exportedAt: string;
  user: { id: string; email: string };
  mobilityProfile: Profile;
  savedJourneys: unknown[];
}

export { TransportMode };
