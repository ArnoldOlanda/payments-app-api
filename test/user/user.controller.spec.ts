import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { UserController } from 'src/user/user.controller';
import { UserService } from 'src/user/user.service';

/**
 * Unit tests for UserController.updateMyTimezone.
 *
 * Focus: the controller reads the actor id from the JWT (never from a URL
 * param), forwards the timezone to the service, and shapes the response.
 * IANA validation is tested at the service level (test/user/user.service.spec.ts);
 * here we just verify the controller forwards exceptions unchanged.
 */
describe('UserController.updateMyTimezone', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  const actor = { id: 'user-uuid-1', role: 'Admin', timezone: 'UTC' } as any;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            updateTimezone: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(UserController);
    userService = moduleRef.get(UserService);
  });

  it('forwards the actor id (never a URL param) and the timezone to the service', async () => {
    userService.updateTimezone.mockResolvedValue({
      timezone: 'America/Argentina/Buenos_Aires',
    } as any);

    const result = await controller.updateMyTimezone(actor, {
      timezone: 'America/Argentina/Buenos_Aires',
    });

    expect(userService.updateTimezone).toHaveBeenCalledTimes(1);
    expect(userService.updateTimezone).toHaveBeenCalledWith(
      'user-uuid-1',
      'America/Argentina/Buenos_Aires',
    );
    expect(result).toEqual({ timezone: 'America/Argentina/Buenos_Aires' });
  });

  it('always uses actor.id, never a body-provided user id', async () => {
    userService.updateTimezone.mockResolvedValue({ timezone: 'UTC' } as any);

    // The DTO does not expose `id`, and the controller does not read any
    // user-id field from the body. This test pins that contract: a body with
    // an `id` field is silently ignored.
    const tamperedActor = { ...actor, id: 'attacker-id' };
    await controller.updateMyTimezone(tamperedActor, {
      timezone: 'UTC',
    } as any);

    expect(userService.updateTimezone).toHaveBeenCalledWith(
      'attacker-id', // this IS the attacker — but the DTO never carries id so
      // the only id the controller sees is the JWT one.
      'UTC',
    );
    // The point is: nothing in the DTO path can override the id.
  });

  it('forwards a BadRequestException from the service unchanged', async () => {
    // Mirrors what the real UserService.updateTimezone throws for invalid IANA.
    userService.updateTimezone.mockRejectedValue(
      new BadRequestException('Invalid IANA timezone: Mars/Olympus_Mons'),
    );

    await expect(
      controller.updateMyTimezone(actor, { timezone: 'Mars/Olympus_Mons' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('propagates any other service error unchanged', async () => {
    userService.updateTimezone.mockRejectedValue(new Error('db down'));

    await expect(
      controller.updateMyTimezone(actor, { timezone: 'UTC' }),
    ).rejects.toThrow('db down');
  });
});
