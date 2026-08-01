import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CollectionsWeeklyQueryDto {
  @ApiProperty({
    example: '2026-07-06',
    description:
      'Anchor day of the week (YYYY-MM-DD, calendar day in the actor timezone). ' +
      'The service normalizes to the Monday of that week. Monday is the first day ' +
      '(matches the PDF ficha de pagos).',
  })
  @Matches(CALENDAR_DAY, { message: 'weekStart must be YYYY-MM-DD' })
  weekStart: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Zone whose accounts are listed (required, weekly view is per-zone, same as ' +
      'the PDF ficha de pagos).',
  })
  @IsUUID('4')
  zoneId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional collector filter. When set, only payments registered by this user ' +
      'populate the per-day cells (accounts listed are still those of the zone).',
  })
  @IsOptional()
  @IsUUID('4')
  userId?: string;
}
