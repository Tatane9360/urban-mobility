import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt.guard';
import type { AuthenticatedRequest } from './jwt.guard';
import type { UserDataExportDto } from './dto/user-data-export.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user and its Mobility Profile' })
  @ApiResponse({
    status: 201,
    description: 'User created, access token issued',
  })
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<{ accessToken: string }> {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Access token issued' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @Post('login')
  login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ id: string; email: string }> {
    return this.authService.getCurrentUser(request.userId);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Export all data held on the authenticated user (GDPR portability)',
  })
  @ApiResponse({ status: 200, description: 'User data, without passwordHash' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @UseGuards(JwtAuthGuard)
  @Get('me/export')
  exportData(@Req() request: AuthenticatedRequest): Promise<UserDataExportDto> {
    return this.authService.exportUserData(request.userId);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete the authenticated user and all its data (GDPR erasure)',
  })
  @ApiResponse({ status: 204, description: 'Account and all its data deleted' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(204)
  deleteAccount(@Req() request: AuthenticatedRequest): Promise<void> {
    return this.authService.deleteAccount(request.userId);
  }
}
