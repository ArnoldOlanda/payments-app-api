import { ValidationPipe } from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';

import { ToBoolean } from 'src/common/decorators/to-boolean.decorator';

class BooleanQueryDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  flag?: boolean;
}

describe('ToBoolean', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  });

  const transform = (flag: unknown) =>
    pipe.transform(
      { flag },
      {
        type: 'query',
        metatype: BooleanQueryDto,
      },
    );

  it.each([
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
  ])('converts %p to %p', async (input, expected) => {
    const dto = await transform(input);

    expect(dto.flag).toBe(expected);
  });

  it.each(['1', '0', 'yes', '', 'TRUE', 'FALSE'])(
    'leaves unsupported value %p for validation to reject',
    async (input) => {
      await expect(transform(input)).rejects.toThrow();
    },
  );

  it('preserves an omitted optional value', async () => {
    const dto = await pipe.transform(
      {},
      {
        type: 'query',
        metatype: BooleanQueryDto,
      },
    );

    expect(dto.flag).toBeUndefined();
  });
});
