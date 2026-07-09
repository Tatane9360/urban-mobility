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
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_SALT_ROUNDS = 10;
// ponytail: Postgres unique_violation code, see
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
      throw new NotFoundException('User not found');
    }
    return { id: user.id, email: user.email };
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
