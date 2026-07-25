import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CollectionsReportQueryDto } from 'src/report/dto/collections-report-query.dto';

describe('CollectionsReportQueryDto', () => {
  const toDto = (plain: Record<string, unknown>) =>
    plainToInstance(CollectionsReportQueryDto, plain);

  const getError = (errors: any[], property: string) =>
    errors.find((e) => e.property === property);

  it('passes validation with no query params (everything optional)', async () => {
    const dto = toDto({});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('passes validation with the full happy-path payload', async () => {
    const dto = toDto({
      from: '2026-07-01',
      to: '2026-07-31',
      userId: '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3a',
      zoneId: '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3b',
      page: 2,
      limit: 25,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('defaults page to 1 and limit to 10 when not provided', () => {
    const dto = toDto({});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
  });

  it('fails when from is not YYYY-MM-DD', async () => {
    const dto = toDto({ from: '2026/07/01' });
    const errors = await validate(dto);
    expect(getError(errors, 'from')).toBeDefined();
  });

  it('fails when to is not YYYY-MM-DD', async () => {
    const dto = toDto({ to: '01-07-2026' });
    const errors = await validate(dto);
    expect(getError(errors, 'to')).toBeDefined();
  });

  it('does not fail when only from is provided', async () => {
    const dto = toDto({ from: '2026-07-01' });
    const errors = await validate(dto);
    expect(getError(errors, 'from')).toBeUndefined();
    expect(getError(errors, 'to')).toBeUndefined();
  });

  it('fails when userId is not a UUID', async () => {
    const dto = toDto({ userId: 'not-a-uuid' });
    const errors = await validate(dto);
    expect(getError(errors, 'userId')).toBeDefined();
  });

  it('fails when zoneId is not a UUID', async () => {
    const dto = toDto({ zoneId: 'not-a-uuid' });
    const errors = await validate(dto);
    expect(getError(errors, 'zoneId')).toBeDefined();
  });

  it('fails when page is less than 1', async () => {
    const dto = toDto({ page: 0 });
    const errors = await validate(dto);
    expect(getError(errors, 'page')).toBeDefined();
  });

  it('fails when limit is less than 1', async () => {
    const dto = toDto({ limit: 0 });
    const errors = await validate(dto);
    expect(getError(errors, 'limit')).toBeDefined();
  });

  it('does not fail when page is 1 and limit is 1 (minimum)', async () => {
    const dto = toDto({ page: 1, limit: 1 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
