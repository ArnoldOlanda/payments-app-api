import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCustomerDto } from 'src/customer/dto/create-customer.dto';

describe('CreateCustomerDto', () => {
  const toDto = (plain: Record<string, unknown>) =>
    plainToInstance(CreateCustomerDto, plain);

  const getError = (errors: any[], property: string) =>
    errors.find((e) => e.property === property);

  it('passes validation with only name and lastName (minimal payload)', async () => {
    const dto = toDto({ name: 'Juan', lastName: 'Pérez' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('passes validation with all fields filled (happy path)', async () => {
    const dto = toDto({
      documentNumber: '12345678',
      name: 'Juan',
      lastName: 'Pérez',
      address: 'Av. Siempre Viva 742',
      phone: '987654321',
      email: 'juan@example.com',
      zoneId: '5e1c1f6b-7b3d-4a2b-9a8c-1f3b6c8c2f3a',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('fails when name is missing', async () => {
    const dto = toDto({ lastName: 'Pérez' });

    const errors = await validate(dto);

    expect(getError(errors, 'name')).toBeDefined();
  });

  it('fails when lastName is missing', async () => {
    const dto = toDto({ name: 'Juan' });

    const errors = await validate(dto);

    expect(getError(errors, 'lastName')).toBeDefined();
  });

  it('does not fail when documentNumber is missing', async () => {
    const dto = toDto({ name: 'Juan', lastName: 'Pérez' });

    const errors = await validate(dto);

    expect(getError(errors, 'documentNumber')).toBeUndefined();
  });

  it('does not fail when documentNumber is empty string', async () => {
    const dto = toDto({ documentNumber: '', name: 'Juan', lastName: 'Pérez' });

    const errors = await validate(dto);

    expect(getError(errors, 'documentNumber')).toBeUndefined();
  });

  it('fails when documentNumber is not 8-10 chars', async () => {
    const dto = toDto({
      documentNumber: '123',
      name: 'Juan',
      lastName: 'Pérez',
    });

    const errors = await validate(dto);

    expect(getError(errors, 'documentNumber')).toBeDefined();
  });

  it('does not fail when phone is missing', async () => {
    const dto = toDto({ name: 'Juan', lastName: 'Pérez' });

    const errors = await validate(dto);

    expect(getError(errors, 'phone')).toBeUndefined();
  });

  it('does not fail when phone is empty string', async () => {
    const dto = toDto({ phone: '', name: 'Juan', lastName: 'Pérez' });

    const errors = await validate(dto);

    expect(getError(errors, 'phone')).toBeUndefined();
  });

  it('fails when phone is provided with wrong length', async () => {
    const dto = toDto({ phone: '12345', name: 'Juan', lastName: 'Pérez' });

    const errors = await validate(dto);

    expect(getError(errors, 'phone')).toBeDefined();
  });

  it('passes when phone is provided with valid length', async () => {
    const dto = toDto({ phone: '987654321', name: 'Juan', lastName: 'Pérez' });

    const errors = await validate(dto);

    expect(getError(errors, 'phone')).toBeUndefined();
  });

  it('does not fail when email is missing', async () => {
    const dto = toDto({ name: 'Juan', lastName: 'Pérez' });

    const errors = await validate(dto);

    expect(getError(errors, 'email')).toBeUndefined();
  });

  it('fails when email is invalid format', async () => {
    const dto = toDto({
      email: 'not-an-email',
      name: 'Juan',
      lastName: 'Pérez',
    });

    const errors = await validate(dto);

    expect(getError(errors, 'email')).toBeDefined();
  });

  it('does not fail when address is missing', async () => {
    const dto = toDto({ name: 'Juan', lastName: 'Pérez' });

    const errors = await validate(dto);

    expect(getError(errors, 'address')).toBeUndefined();
  });

  it('does not fail when zoneId is missing', async () => {
    const dto = toDto({ name: 'Juan', lastName: 'Pérez' });

    const errors = await validate(dto);

    expect(getError(errors, 'zoneId')).toBeUndefined();
  });

  it('fails when zoneId is not a valid UUID', async () => {
    const dto = toDto({
      zoneId: 'not-a-uuid',
      name: 'Juan',
      lastName: 'Pérez',
    });

    const errors = await validate(dto);

    expect(getError(errors, 'zoneId')).toBeDefined();
  });
});
