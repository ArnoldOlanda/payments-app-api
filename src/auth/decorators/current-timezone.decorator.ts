import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Actor } from 'src/auth/types/actor.type';

/**
 * Extracts the IANA timezone from the authenticated actor.
 *
 * Resolves to the `timezone` claim on the JWT (which is the value persisted on
 * the user row at the time of login). For tokens issued before this feature
 * landed, the JwtStrategy falls back to the user row's stored timezone.
 *
 * Throws nothing; returns undefined if the actor has no timezone (which should
 * never happen post-migration because every user row gets `'UTC'` by default).
 */
export const CurrentTimezone = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const req = context.switchToHttp().getRequest();
    const actor = req.user as Actor | undefined;
    return actor?.timezone ?? 'UTC';
  },
);
