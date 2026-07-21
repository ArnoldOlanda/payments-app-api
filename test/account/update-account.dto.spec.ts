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

  it('accepts all fields inherited from CreateAccountDto', async () => {
    const dto = await transform({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      creditType: 'diario',
      date: '2025-01-01T00:00:00.000Z',
      dueDate: '2025-02-01T00:00:00.000Z',
      amount: 100,
      interest: 5,
    });

    expect(dto.customerId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(dto.creditType).toBe('diario');
    expect(dto.date).toBeInstanceOf(Date);
    expect(dto.dueDate).toBeInstanceOf(Date);
    expect(dto.amount).toBe(100);
    expect(dto.interest).toBe(5);
  });

  it('inherits the non-negative amount validation from CreateAccountDto', async () => {
    await expect(transform({ amount: -1 })).rejects.toThrow();
  });
});
