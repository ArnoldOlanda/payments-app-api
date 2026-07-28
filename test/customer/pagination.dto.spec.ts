import { ValidationPipe } from '@nestjs/common';

import { PaginationDto } from 'src/customer/dto/pagination.dto';

describe('Customer PaginationDto', () => {
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
      metatype: PaginationDto,
    });

  it('parses all=false without coercing the non-empty string to true', async () => {
    const dto = await transform({ all: 'false' });

    expect(dto.all).toBe(false);
  });

  it('parses all=true', async () => {
    const dto = await transform({ all: 'true' });

    expect(dto.all).toBe(true);
  });

  it('rejects unsupported all values', async () => {
    await expect(transform({ all: '1' })).rejects.toThrow();
  });
});
