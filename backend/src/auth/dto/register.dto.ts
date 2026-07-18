import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Email address, used as login',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Password, minimum 8 characters',
    example: 'hunter22',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
