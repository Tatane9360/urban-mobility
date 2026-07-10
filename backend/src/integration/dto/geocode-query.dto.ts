import { IsNotEmpty, IsString } from 'class-validator';

export class GeocodeQueryDto {
  @IsString()
  @IsNotEmpty()
  q: string;
}
