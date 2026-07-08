import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { SeedService } from './seed.service';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  @Auth(ValidRole.ADMIN)
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
