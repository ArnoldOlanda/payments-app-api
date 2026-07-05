import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  executeSeed() {
    if (
      process.env.NODE_ENV === 'prod' ||
      process.env.NODE_ENV === 'production'
    ) {
      throw new InternalServerErrorException('Seed is disabled in production');
    }
    return this.seedService.executeSeed();
  }
}
