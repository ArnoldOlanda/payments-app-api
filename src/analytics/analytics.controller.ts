import { Controller, Get, Query } from '@nestjs/common';

import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CurrentTimezone } from 'src/auth/decorators/current-timezone.decorator';
import { Actor } from 'src/auth/types/actor.type';

import { AnalyticsService } from './analytics.service';
import { CollectionsRangeDto } from './dto/collections-range.dto';
import { AnalyticsLimitDto } from './dto/analytics-limit.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('kpis')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  getKpis(
    @Query('zoneId') zoneId: string | undefined,
    @CurrentUser() actor: Actor,
    @CurrentTimezone() tz: string,
  ) {
    return this.analyticsService.getKpis(zoneId, actor, tz);
  }

  @Get('collections')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  getCollections(
    @Query() query: CollectionsRangeDto,
    @CurrentUser() actor: Actor,
    @CurrentTimezone() tz: string,
  ) {
    return this.analyticsService.getCollections(query, actor, tz);
  }

  @Get('distribution/zones')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  getZoneDistribution(
    @Query('zoneId') zoneId: string | undefined,
    @CurrentUser() actor: Actor,
  ) {
    return this.analyticsService.getZoneDistribution(zoneId, actor);
  }

  @Get('upcoming-due')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  getUpcomingDue(
    @Query() query: AnalyticsLimitDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.analyticsService.getUpcomingDue(
      query.zoneId,
      query.limit ?? 10,
      actor,
    );
  }

  @Get('recent-payments')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  getRecentPayments(
    @Query() query: AnalyticsLimitDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.analyticsService.getRecentPayments(
      query.zoneId,
      query.limit ?? 10,
      query.from,
      query.to,
      actor,
      query.userId,
    );
  }
}
