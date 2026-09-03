import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DataSource, QueryFailedError } from 'typeorm';
import { User } from './entities/user.entity';
import { MobilityProfile } from './entities/mobility-profile.entity';
import { SavedJourney } from '../journeys/entities/saved-journey.entity';
import { SavedJourneyResponseDto } from '../journeys/dto/saved-journey-response.dto';
import { ProfileResponseDto } from '../profile/dto/profile-response.dto';
import { UserDataExportDto } from './dto/user-data-export.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_SALT_ROUNDS = 10;
// Postgres unique_violation
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    let user: User;
    try {
      user = await this.dataSource.transaction(async (manager) => {
        const profile = await manager.getRepository(MobilityProfile).save(
          manager.getRepository(MobilityProfile).create({
            preferredModes: [],
            favoriteAddresses: [],
          }),
        );
        return manager.getRepository(User).save(
          manager.getRepository(User).create({
            email: dto.email,
            passwordHash,
            mobilityProfile: profile,
          }),
        );
      });
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string })?.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }

    return { accessToken: this.signToken(user.id) };
  }

  async getCurrentUser(userId: string): Promise<{ id: string; email: string }> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId } });
    if (!user) {
      // 401, not 404: the token is syntactically valid but its subject no
      // longer exists (deleted account), which makes it a rejected
      // credential rather than a missing resource.
      throw new UnauthorizedException('Invalid or expired token');
    }
    return { id: user.id, email: user.email };
  }

  // GDPR right to erasure. saved_journey (and through it
  // saved_journey_segment) cascades from the app_user row on its own. The
  // Mobility Profile does not: the 1-1 FK lives on app_user pointing AT
  // mobility_profile, so MobilityProfile.user's onDelete: 'CASCADE' sits on
  // the inverse side and emits no constraint. Both rows go in one
  // transaction, in FK order.
  async deleteAccount(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: userId },
        relations: { mobilityProfile: true },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      await manager.getRepository(User).delete(userId);
      await manager
        .getRepository(MobilityProfile)
        .delete(user.mobilityProfile.id);
    });
  }

  // GDPR right to portability. Built from the same response DTOs the API
  // already serves, so passwordHash has no path into this payload.
  async exportUserData(userId: string): Promise<UserDataExportDto> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      relations: { mobilityProfile: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const journeys = await this.dataSource.getRepository(SavedJourney).find({
      where: { userDbId: userId },
      relations: { segments: true },
      order: { savedAt: 'DESC' },
    });

    return {
      exportedAt: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      mobilityProfile: ProfileResponseDto.fromEntity(user.mobilityProfile),
      savedJourneys: journeys.map((journey) =>
        SavedJourneyResponseDto.fromEntity(journey),
      ),
    };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { accessToken: this.signToken(user.id) };
  }

  private signToken(userId: string): string {
    return this.jwtService.sign({ sub: userId });
  }
}
