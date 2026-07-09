import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest): Promise<ProfileResponseDto> {
    return this.profileService.getForUser(request.userId);
  }

  @Patch()
  update(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.profileService.updateForUser(request.userId, dto);
  }
}
