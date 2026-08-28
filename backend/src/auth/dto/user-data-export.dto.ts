import { ProfileResponseDto } from '../../profile/dto/profile-response.dto';
import { SavedJourneyResponseDto } from '../../journeys/dto/saved-journey-response.dto';

// GDPR portability payload. Deliberately a plain shape composed of the
// existing response DTOs — none of them carries passwordHash.
export interface UserDataExportDto {
  exportedAt: string;
  user: { id: string; email: string };
  mobilityProfile: ProfileResponseDto;
  savedJourneys: SavedJourneyResponseDto[];
}
