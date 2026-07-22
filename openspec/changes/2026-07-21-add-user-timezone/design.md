# Design — add-user-timezone

Implements the spec at `openspec/changes/2026-07-21-add-user-timezone/specs/{user,auth,analytics,report}/spec.md`.

## Affected Files

| Path | Change |
|---|---|
| `src/user/entities/user.entity.ts` | Add `timezone` column |
| `src/migrations/<ts>-AddUserTimezone.ts` | Generated migration (up + down) |
| `src/auth/types/actor.type.ts` | Add `timezone: string` |
| `src/auth/jwt.strategy.ts` | Return `timezone` on validated actor |
| `src/auth/auth.service.ts` | Read `X-Timezone` header, validate, persist, embed in JWT |
| `src/auth/decorators/current-timezone.decorator.ts` | New `@CurrentTimezone()` decorator |
| `src/common/datetime/iana-timezone.validator.ts` | New `assertIanaTimezone` helper |
| `src/common/datetime/tempo.ts` | New wrapper over `@formkit/tempo` |
| `src/user/dto/update-timezone.dto.ts` | New DTO with `@MaxLength(64)` + custom validator |
| `src/user/user.controller.ts` | Add `PATCH /users/me/timezone` |
| `src/user/user.service.ts` | Add `updateTimezone(userId, tz)` |
| `src/analytics/analytics.service.ts` | Accept `tz`, pass to date helpers |
| `src/analytics/analytics.controller.ts` | Inject `@CurrentTimezone()` |
| `src/report/report.service.ts` | Accept `tz`, pass to date helpers + `format` |
| `src/report/report.controller.ts` | Inject `@CurrentTimezone()` |
| `test/common/datetime/iana-timezone.validator.spec.ts` | New |
| `test/common/datetime/tempo.spec.ts` | New |
| `test/user/user.service.spec.ts` | Add `describe('updateTimezone')` |
| `test/auth/auth.service.spec.ts` | Extend with `X-Timezone` cases |
| `test/auth/jwt.strategy.spec.ts` | Extend with `timezone` claim |
| `test/analytics/analytics.service.spec.ts` | Extend with TZ-aware cases |
| `test/report/report.service.spec.ts` | Extend with TZ-aware cases |

No new external dependency. `@formkit/tempo` and `class-validator` are already installed.

## Data Flow — TZ capture and persistence

### Header read (auth guard / login)

1. Auth pipeline extracts `req.headers['x-timezone']` (case-insensitive).
2. If present, `assertIanaTimezone(tz)` runs:
   ```ts
   new Intl.DateTimeFormat('en-US', { timeZone: tz });
   ```
   Throws `BadRequestException('Invalid IANA timezone: <value>')` on failure.
3. If valid AND differs from `user.timezone`, persist via `userRepository.update(id, { timezone: tz })`. Idempotent — no write when equal.
4. JWT payload includes `timezone: user.timezone` (the persisted value, regardless of header presence).

### Subsequent requests without header

5. Auth guard does not call the DB. `req.user.timezone` comes from the JWT claim.
6. If a token is older than the last TZ change, the user must re-login to refresh. This is the documented Option A behavior.

## Data Flow — `analytics.service` range computation

Range methods change signature to accept `tz`:

```ts
async getKpis(tz: string): Promise<KpiResponse> {
  const todayStart = dayStart(new Date(), tz);
  const todayEnd = dayEnd(new Date(), tz);
  // ...
}
```

The controller wires it:

```ts
@Get('kpis')
async kpis(@CurrentTimezone() tz: string) {
  return this.analyticsService.getKpis(tz);
}
```

## Data Flow — `report.service` range + PDF display

`getDaysWeek` becomes `getDaysWeek(tz)` and uses `weekStart(new Date(), 1, tz)` + `weekEnd(new Date(), 1, tz)`. PDF generation (`getFichaPagos`) accepts `tz` via the controller and formats dates via `format(date, 'dd/MM/yyyy', tz)`.

## Centralized wrapper — `src/common/datetime/tempo.ts`

The wrapper is the single point through which all TZ-aware date math passes. Its signature is `(date, ...args, tz)` so callers cannot forget the TZ.

### Verified API constraints of `@formkit/tempo` v0.1.2

Inspected the installed types and source. The library is **not** TZ-uniform:

| Function | TZ option? | Notes |
|---|---|---|
| `dayStart(d)` / `dayEnd(d)` | NO | Uses device TZ only. No options bag. |
| `weekStart(d, startOfWeekDay?)` / `weekEnd(d, startOfWeekDay?)` | NO | Same. |
| `format({ date, format, tz, ... })` | YES | Options bag accepts `tz: string`. |
| `tzDate(d, tz)` | partial | Treats `d` as device-local and applies `(device - tz)` offset. NOT a wall-clock → UTC tool. |

So for `dayStart/dayEnd/weekStart/weekEnd`, we cannot delegate to `@formkit/tempo`. We implement them directly using `Intl.DateTimeFormat`.

### Algorithm for TZ-aware `dayStart` / `dayEnd`

```
input:  now: Date, tz: string
output: Date (UTC instant of midnight / 23:59:59.999 of the day-of-now-as-seen-in-tz)

1. Extract year/month/day of `now` as observed in tz via Intl.DateTimeFormat.formatToParts.
2. Build the wall-clock string "YYYY-MM-DDTHH:mm:ss" with those parts.
3. Compute the offset of tz at noon on that calendar day in tz (noon avoids the DST-transition midnight ambiguity):
     parts = Intl.DateTimeFormat({ timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(noon)
     offsetStr = parts.find(p => p.type === 'timeZoneName').value.replace('GMT', '') || '+00:00'
4. Compose the ISO string with explicit offset and parse via `new Date()`:
     return new Date(`${YYYY}-${MM}-${DD}T00:00:00${offsetStr}`)
   For dayEnd, use `23:59:59.999`.
```

`longOffset` gives `±HH:MM` form which `new Date()` parses deterministically. DST transitions are handled because we read the offset for noon of *that specific calendar day*.

### Algorithm for TZ-aware `weekStart` / `weekEnd`

```
input:  now: Date, startOfWeekDay: number (0=Sun..6=Sat), tz: string
output: Date (UTC instant of midnight of the Monday-or-other-start day)

1. Extract year/month/day/weekday of `now` as observed in tz.
2. daysBack = (weekday - startOfWeekDay + 7) % 7
3. Compute the target calendar date in tz by subtracting daysBack from the day-of-now.
   Use UTC date math on the parts to avoid device-TZ contamination:
     candidate = new Date(Date.UTC(year, month - 1, day - daysBack))
4. Re-extract year/month/day from `candidate` AS SEEN IN tz (handles month/year wrap correctly under DST).
5. Delegate to dayStartTZ(parts, tz).
```

`weekEnd` is computed as `weekStart + 7 days − 1 ms` (the start of the *next* week minus 1 ms).

### `format` passes through

```ts
import { format as _format } from '@formkit/tempo';
export const format = (d: Date, fmt: string, tz: string) =>
  _format({ date: d, format: fmt, tz });
```

### Why this wrapper

- Forces every consumer to declare a TZ (signature-level guarantee).
- Single source of truth — if we ever swap `@formkit/tempo` for another lib, only the wrapper changes.
- No new dependency; `Intl.DateTimeFormat` is built into Node.
- DST-correct because the offset is read per-call from the live IANA database.

### Device TZ on this container

Confirmed via `Intl.DateTimeFormat().resolvedOptions().timeZone` → `America/Lima` (UTC-5). This is the leak that today's analytics and reports exhibit; the wrapper fixes it without requiring a container TZ change.

## Validation helper — `assertIanaTimezone`

```ts
import { BadRequestException } from '@nestjs/common';

export function assertIanaTimezone(tz: string): void {
  if (!tz || typeof tz !== 'string' || tz.length > 64) {
    throw new BadRequestException(`Invalid IANA timezone: ${tz}`);
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    throw new BadRequestException(`Invalid IANA timezone: ${tz}`);
  }
}
```

This intentionally rejects offset syntax (`UTC+3`, `+05:30`) — the project stores IANA identifiers exclusively.

## Cross-Domain Contract

- `JwtStrategy.validate` returns `Actor & { timezone: string }`. Callers that already use `@CurrentUser()` will not break — they get an extra field. Callers that destructure the actor may pick up the new field without changes.
- `X-Timezone` header is consumed by the auth guard and persisted lazily. Other guards (e.g., zone-scope, throttler) are unaffected.
- Migration is reversible. Existing users default to `'UTC'` post-deploy.
- No external service (Resend, Cloudinary, PDF) receives a TZ string. All timestamps leave the API as ISO UTC.
- The `zone` business-zone concept is untouched. There is no read or write path that confuses the two.

## Test Plan

| File | New cases |
|---|---|
| `test/common/datetime/iana-timezone.validator.spec.ts` | Accept `'America/Argentina/Buenos_Aires'`; accept `'UTC'`; reject `'Mars/Olympus_Mons'` → `BadRequestException`; reject `'UTC+3'` (offset syntax); reject empty string; reject length > 64 |
| `test/common/datetime/tempo.spec.ts` | `dayStart` with `tz = 'Asia/Tokyo'` returns midnight in that TZ; `weekStart` Monday-aligned in `tz = 'America/Argentina/Buenos_Aires'`; `format` with `tz` produces the expected localized string |
| `test/user/user.service.spec.ts` | `updateTimezone` writes row; rejects invalid IANA with `BadRequestException` |
| `test/auth/auth.service.spec.ts` | Login with `X-Timezone: America/Argentina/Buenos_Aires` persists and embeds in JWT; login with invalid header returns 400 and does not persist; login without header does not touch the row |
| `test/auth/jwt.strategy.spec.ts` | `JwtStrategy.validate` returns `Actor & { timezone }` from the payload |
| `test/analytics/analytics.service.spec.ts` | `getKpis(tz)` uses `tz` to compute `dayStart`/`dayEnd`; existing range-boundary tests are updated to pass an explicit TZ |
| `test/report/report.service.spec.ts` | `getDaysWeek(tz)` returns 7 days starting Monday in `tz`; `getFichaPagos(tz)` formats PDF dates in `tz` |

## Rollout

1. Feature branch off `main` (`feat/user-timezone`).
2. Migration runs in `migrator` service on next deploy (existing pattern).
3. Local: `yarn lint`, `yarn test`, `yarn test:e2e` (or skip e2e per repo convention if no local Postgres).
4. Phase 1 PR title: `feat(api): per-user timezone foundation (schema, auth, validator, endpoint)`.
5. Phase 2 PR title: `feat(api): per-user timezone for analytics and reports`.
6. After Phase 2 merge: notify mobile/web owners to send `X-Timezone` header on every request and format dates locally using `Intl.DateTimeFormat` with the user's TZ.

## Open Decisions

1. **Wrapper vs direct option passing.** Using a centralized wrapper is recommended (single point of truth, prevents future drift). Decision: wrapper. If the team prefers direct option passing, the wrapper becomes a no-op.
2. **`@formkit/tempo` TZ support.** RESOLVED: only `format` accepts `tz`. `dayStart/dayEnd/weekStart/weekEnd` do not. Wrapper implements those directly with `Intl.DateTimeFormat`. Closed.
3. **Header name.** `X-Timezone` is a de-facto convention (matches GitHub, Vercel, etc.). Alternative considered: `X-User-Timezone`. Decision: `X-Timezone`.
4. **Chained PR strategy.** Total estimated lines ~620 (entity 5, migration 25, auth 60, validators 30, wrapper 20, controller 20, service 40, analytics 30, report 40, tests ~350) exceeds the 400-line review budget. Split into two PRs (Phase 1 foundation, Phase 2 consumers) per `work-unit-commits`.
