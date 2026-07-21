import { ValidationPipe } from '@nestjs/common';

import { UpdateAccountDto } from 'src/account/dto/update-account.dto';

describe('UpdateAccountDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  });

  const transform = (payload: Record<string, unknown>) =>
    pipe.transform(payload, {
      type: 'body',
      metatype: UpdateAccountDto,
    });

  it('accepts dueDate without requiring date in the request body', async () => {
    const dto = await transform({ dueDate: '2025-02-01T00:00:00.000Z' });

    expect(dto.dueDate).toBeInstanceOf(Date);
  });

  it('accepts date fields sent as ISO strings', async () => {
    const dto = await transform({
      date: '2025-01-01T00:00:00.000Z',
      dueDate: '2025-02-01T00:00:00.000Z',
    });

    expect(dto.date).toBeInstanceOf(Date);
    expect(dto.dueDate).toBeInstanceOf(Date);
  });
});
