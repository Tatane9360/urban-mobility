import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MobilityProfile } from '../auth/entities/mobility-profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(MobilityProfile)
    private readonly profileRepository: Repository<MobilityProfile>,
  ) {}

  async getForUser(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.findByUserIdOrThrow(userId);
    return ProfileResponseDto.fromEntity(profile);
  }

  async updateForUser(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const profile = await this.findByUserIdOrThrow(userId);
    // Field by field, not Object.assign(profile, dto): keeps the assignable
    // surface pinned to these three even if the entity grows a field sharing a
    // DTO name.
    if (dto.preferredModes !== undefined) {
      profile.preferredModes = dto.preferredModes;
    }
    if (dto.favoriteAddresses !== undefined) {
      profile.favoriteAddresses = dto.favoriteAddresses;
    }
    if (dto.pmrAccessibility !== undefined) {
      profile.pmrAccessibility = dto.pmrAccessibility;
    }
    const saved = await this.profileRepository.save(profile);
    return ProfileResponseDto.fromEntity(saved);
  }

  // Filtering on user.id does not load the `user` relation, so the response
  // can never carry User fields (passwordHash) back out.
  private async findByUserIdOrThrow(userId: string): Promise<MobilityProfile> {
    const profile = await this.profileRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!profile) {
      throw new NotFoundException('Mobility Profile not found');
    }
    return profile;
  }
}
