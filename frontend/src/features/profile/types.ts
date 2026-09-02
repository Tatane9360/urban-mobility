import { TransportMode } from '../journey-planner/types';

// Mirrors backend/src/profile/favorite-address.ts
export interface FavoriteAddress {
  label: string;
  address: string;
}

// Mirrors backend/src/profile/dto/profile-response.dto.ts
export interface Profile {
  preferredModes: TransportMode[];
  favoriteAddresses: FavoriteAddress[];
  pmrAccessibility: boolean;
}

// Mirrors backend/src/profile/dto/update-profile.dto.ts
export interface UpdateProfileRequest {
  preferredModes?: TransportMode[];
  favoriteAddresses?: FavoriteAddress[];
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
