import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

// Optional period filter on savedAt. Both bounds are inclusive. Validated and
// transformed to Date here, so the service only ever hands the query builder
// a real Date as a bound parameter — never raw query-string text.
export class SavedJourneyStatsQueryDto {
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to?: Date;
}
