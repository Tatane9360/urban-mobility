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
    // ponytail: explicit field-by-field assignment, not Object.assign(profile,
    // dto) — keeps the assignable surface pinned to these 3 fields even if
    // MobilityProfile later grows a field that happens to share a DTO name.
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

  // ponytail: filtering on `user.id` doesn't require loading the `user`
  // relation itself — avoids the profile response ever carrying User fields
  // (passwordHash) back out through the controller.
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
