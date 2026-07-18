import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Password', example: 'hunter22' })
  @IsString()
  password!: string;
}
