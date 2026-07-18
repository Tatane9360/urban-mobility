import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/jwt.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @ApiOperation({ summary: "Get the current user's Mobility Profile" })
  @ApiResponse({
    status: 200,
    description: 'Mobility Profile',
    type: ProfileResponseDto,
  })
  @Get()
  get(@Req() request: AuthenticatedRequest): Promise<ProfileResponseDto> {
    return this.profileService.getForUser(request.userId);
  }

  @ApiOperation({ summary: "Update the current user's Mobility Profile" })
  @ApiResponse({
    status: 200,
    description: 'Updated Mobility Profile',
    type: ProfileResponseDto,
  })
  @Patch()
  update(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.profileService.updateForUser(request.userId, dto);
  }
}
