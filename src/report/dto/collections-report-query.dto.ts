import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Min } from 'class-validator';

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CollectionsReportQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    description:
      'Inclusive lower bound, calendar day in the actor timezone (YYYY-MM-DD). Optional; defaults to today.',
  })
  @IsOptional()
  @Matches(CALENDAR_DAY, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description:
      'Inclusive upper bound, calendar day in the actor timezone (YYYY-MM-DD). Optional; defaults to today.',
  })
  @IsOptional()
  @Matches(CALENDAR_DAY, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Restrict results to payments registered by a specific user. Optional.',
  })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Restrict results to a specific customer zone. Optional.',
  })
  @IsOptional()
  @IsUUID('4')
  zoneId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    description: 'Capped at 200 by the service.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}
