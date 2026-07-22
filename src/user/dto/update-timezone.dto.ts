import { IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { assertIanaTimezone } from 'src/common/datetime/iana-timezone.validator';

/**
 * Payload for `PATCH /users/me/timezone` and for the `X-Timezone` header on
 * login. Validates shape and IANA membership up-front; runtime check happens
 * inside `UserService.updateTimezone` (same helper).
 */
export class UpdateTimezoneDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64, { message: 'Timezone must be at most 64 characters' })
  timezone: string;
}

/**
 * Custom validator the controller can attach via `@UsePipes` if it wants
 * to share the IANA check with the DTO. Kept separate so DTOs that only
 * need shape validation don't trigger a heavy Intl call on every request.
 */
export const validateIanaTimezone = (value: unknown): void =>
  assertIanaTimezone(value);
