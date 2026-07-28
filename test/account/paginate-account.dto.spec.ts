import { ValidationPipe } from '@nestjs/common';

import { PaginateAccountDto } from 'src/account/dto/paginate-account.dto';

describe('PaginateAccountDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  });

  const transform = (payload: Record<string, unknown>) =>
    pipe.transform(payload, {
      type: 'query',
      metatype: PaginateAccountDto,
    });

  it('parses collectibleToday=true from a query string', async () => {
    const dto = await transform({ collectibleToday: 'true' });

    expect(dto.collectibleToday).toBe(true);
  });

  it('parses collectibleToday=false from a query string', async () => {
    const dto = await transform({ collectibleToday: 'false' });

    expect(dto.collectibleToday).toBe(false);
  });

  it('rejects unsupported boolean query values', async () => {
    await expect(transform({ collectibleToday: 'yes' })).rejects.toThrow();
  });
});
