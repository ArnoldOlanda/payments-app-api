# Tasks — add-user-timezone

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~620 (entity 5, migration 25, auth 60, validators 30, wrapper 20, controller 20, service 40, analytics 30, report 40, tests ~350) |
| 400-line budget risk | Medium-High |
| Chained PRs recommended | Yes |
| Suggested split | 2 PRs: (a) foundation — schema + auth + endpoint + primitives + tests; (b) consumers — analytics + report integration + tests |
| Delivery strategy | chained-pr |
| Chain strategy | two-phase |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: two-phase
400-line budget risk: Medium-High
```

The 400-line budget is exceeded by a single PR. Splitting follows `work-unit-commits`: phase 1 ships the foundation (schema + plumbing + endpoint + tests for those), phase 2 wires the consumers (analytics + report) that depend on the foundation.

## Strict TDD Mode

`STRICT TDD MODE IS ACTIVE. Test runner: yarn test. Follow RED, GREEN, TRIANGULATE, REFACTOR. Record evidence.`

- **RED**: write failing tests for the IANA validator and the tempo wrapper first (Tasks 1.1, 1.6). They are pure functions and the cleanest entry point.
- **GREEN**: minimum implementations.
- **TRIANGULATE**: edge cases (invalid IANA, empty string, offset syntax).
- **REFACTOR**: extract duplication if any (Tasks 5.x) after phase 2's TRIANGULATE.

---

## Phase 1 — Foundation (PR #1)

### 1. RED — Failing tests for primitives

- [ ] Add failing test "assertIanaTimezone accepts 'America/Argentina/Buenos_Aires'" in `test/common/datetime/iana-timezone.validator.spec.ts`. <!-- sdd-owner: implementation -->
- [ ] Add failing test "assertIanaTimezone accepts 'UTC'". <!-- sdd-owner: implementation -->
- [ ] Add failing test "assertIanaTimezone rejects 'Mars/Olympus_Mons'" → `BadRequestException`. <!-- sdd-owner: implementation -->
- [ ] Add failing test "assertIanaTimezone rejects 'UTC+3' (offset, not IANA)". <!-- sdd-owner: implementation -->
- [ ] Add failing test "assertIanaTimezone rejects empty string". <!-- sdd-owner: implementation -->
- [ ] Add failing test "assertIanaTimezone rejects length > 64". <!-- sdd-owner: implementation -->
- [ ] Add failing test "tempo.dayStart with tz='Asia/Tokyo' returns midnight in Tokyo" in `test/common/datetime/tempo.spec.ts`. <!-- sdd-owner: implementation -->
- [ ] Add failing test "tempo.weekStart with tz='America/Argentina/Buenos_Aires' returns Monday-aligned". <!-- sdd-owner: implementation -->
- [ ] Add failing test "tempo.format with tz renders localized string". <!-- sdd-owner: implementation -->
- [ ] Add failing test "tempo.dayStart handles DST transition correctly" (probe with `America/Los_Angeles` on a DST boundary day; the returned UTC instant must match the live IANA offset, not a hardcoded `-08:00`). <!-- sdd-owner: implementation -->
- [ ] Add failing test "tempo.weekStart handles month/year wrap" (e.g., a Sunday in late December with `startOfWeekDay=1` must return the first Monday of January in the next year, in tz). <!-- sdd-owner: implementation -->

### 2. GREEN — Implement primitives

- [ ] Implement `assertIanaTimezone` in `src/common/datetime/iana-timezone.validator.ts` using `new Intl.DateTimeFormat('en-US', { timeZone: tz })`. <!-- sdd-owner: implementation -->
- [ ] Implement `tempo` wrapper in `src/common/datetime/tempo.ts` with `dayStart/dayEnd/weekStart/weekEnd/format` all accepting `tz` and forwarding to `@formkit/tempo` with `{ timeZone: tz }`. <!-- sdd-owner: implementation -->

### 3. RED — User entity

- [ ] Add failing test "user entity has `timezone` column with default 'UTC'" (smoke test in `test/user/user.entity.spec.ts` or extension of existing spec). <!-- sdd-owner: implementation -->

### 4. GREEN — Entity + migration

- [ ] Add `@Column({ type: 'varchar', length: 64, default: 'UTC' }) timezone: string` to `src/user/entities/user.entity.ts`. <!-- sdd-owner: implementation -->
- [ ] Generate migration with `yarn migration:generate src/migrations/AddUserTimezone`. <!-- sdd-owner: implementation -->
- [ ] Verify migration `up` adds column with default `'UTC'` and backfills existing rows. Verify `down` drops the column. <!-- sdd-owner: implementation -->

### 5. RED — Auth pipeline

- [ ] Add failing test "login with `X-Timezone: America/Argentina/Buenos_Aires` persists and embeds in JWT" in `test/auth/auth.service.spec.ts`. <!-- sdd-owner: implementation -->
- [ ] Add failing test "login with invalid `X-Timezone` returns 400 and does not persist". <!-- sdd-owner: implementation -->
- [ ] Add failing test "login without `X-Timezone` does not touch the row". <!-- sdd-owner: implementation -->
- [ ] Add failing test "JwtStrategy.validate returns `Actor & { timezone }`" in `test/auth/jwt.strategy.spec.ts`. <!-- sdd-owner: implementation -->

### 6. GREEN — Auth pipeline

- [ ] Add `timezone: string` to `src/auth/types/actor.type.ts`. <!-- sdd-owner: implementation -->
- [ ] Update `JwtStrategy.validate` to return `timezone` from payload. <!-- sdd-owner: implementation -->
- [ ] Update `auth.service.login` (and any other token-issuing path) to read `X-Timezone`, validate via `assertIanaTimezone`, lazily persist when changed, embed `timezone` in JWT payload. <!-- sdd-owner: implementation -->
- [ ] Add `@CurrentTimezone()` decorator in `src/auth/decorators/current-timezone.decorator.ts` extracting `req.user.timezone`. <!-- sdd-owner: implementation -->

### 7. RED — `PATCH /users/me/timezone`

- [ ] Add failing test "`updateTimezone` writes row" in `test/user/user.service.spec.ts`. <!-- sdd-owner: implementation -->
- [ ] Add failing test "`updateTimezone` rejects invalid IANA with 400". <!-- sdd-owner: implementation -->

### 8. GREEN — endpoint

- [ ] Add `UpdateTimezoneDto` in `src/user/dto/update-timezone.dto.ts` with `@IsString @MaxLength(64)` + custom validator using `assertIanaTimezone`. <!-- sdd-owner: implementation -->
- [ ] Add `updateTimezone(userId, tz)` method in `src/user/user.service.ts`. <!-- sdd-owner: implementation -->
- [ ] Add `PATCH /users/me/timezone` route in `src/user/user.controller.ts` returning `{ timezone }`. <!-- sdd-owner: implementation -->

### 9. Verify phase 1

- [ ] Run `yarn lint`; resolve any new lint errors. <!-- sdd-owner: implementation -->
- [ ] Run `yarn test`; all new tests pass; no regression. <!-- sdd-owner: implementation -->
- [ ] Run `yarn test:e2e` if local Postgres is available; otherwise defer to CI per repo convention. <!-- sdd-owner: implementation -->

### 10. Lifecycle phase 1 (parent-owned)

- [ ] Open PR #1: `feat(api): per-user timezone foundation (schema, auth, validator, endpoint)`. <!-- sdd-owner: parent -->
- [ ] Bounded review on PR #1 (lenses per repo convention). <!-- sdd-owner: parent -->
- [ ] After merge: continue with phase 2 in a fresh branch off `main`. <!-- sdd-owner: parent -->

---

## Phase 2 — Consumers (PR #2)

> Blocked until Phase 1 is merged to `main`.

### 11. RED — analytics TZ-awareness

- [ ] Add failing test "`getKpis(tz)` uses `tz` to compute `dayStart`/`dayEnd`" in `test/analytics/analytics.service.spec.ts`. <!-- sdd-owner: implementation -->
- [ ] Update existing `analytics.service.spec.ts` tests that assumed container TZ to pass an explicit TZ. <!-- sdd-owner: implementation -->

### 12. GREEN — analytics

- [ ] Update `analytics.service.getKpis` (and any other range method) to accept `tz: string` and pass it to the `tempo` wrapper. <!-- sdd-owner: implementation -->
- [ ] Update `analytics.controller` endpoints to inject `@CurrentTimezone()`. <!-- sdd-owner: implementation -->

### 13. RED — report TZ-awareness

- [ ] Add failing test "`getDaysWeek(tz)` returns 7 days starting Monday in tz" in `test/report/report.service.spec.ts`. <!-- sdd-owner: implementation -->
- [ ] Add failing test "`getFichaPagos(tz)` formats PDF dates with tz". <!-- sdd-owner: implementation -->

### 14. GREEN — report

- [ ] Update `report.service.getDaysWeek` and `report.service.getFichaPagos` to accept `tz: string`. <!-- sdd-owner: implementation -->
- [ ] Update `report.controller` endpoints to inject `@CurrentTimezone()`. <!-- sdd-owner: implementation -->
- [ ] Update `report.service.getFichaPagos` PDF generation to format dates with `tempo.format(date, fmt, tz)`. <!-- sdd-owner: implementation -->

### 15. Verify phase 2

- [ ] Run `yarn lint`. <!-- sdd-owner: implementation -->
- [ ] Run `yarn test`. <!-- sdd-owner: implementation -->
- [ ] Run `yarn test:e2e` if available. <!-- sdd-owner: implementation -->

### 16. Refactor (if any duplication emerges)

- [ ] If `dayStart(dayStart(...))` patterns or repeated `tz` plumbing appear, extract a helper. <!-- sdd-owner: implementation -->

### 17. Lifecycle phase 2 (parent-owned)

- [ ] Open PR #2: `feat(api): per-user timezone for analytics and reports`. <!-- sdd-owner: parent -->
- [ ] Bounded review. <!-- sdd-owner: parent -->
- [ ] `sdd-sync` → `sdd-archive` to promote `specs/{user,auth,analytics,report}/spec.md` into canonical `openspec/specs/`. <!-- sdd-owner: parent -->

---

## Dependency Graph

```text
Phase 1:
  1.1 (RED IANA validator canonical)
    └── 2.1 (GREEN IANA validator)
  1.6 (RED tempo wrapper)
    └── 2.2 (GREEN tempo wrapper)
  3.1 (RED entity)
    └── 4.1, 4.2, 4.3 (GREEN entity + migration)
  5.x (RED auth)
    └── 6.x (GREEN auth + decorator)
  7.x (RED endpoint)
    └── 8.x (GREEN endpoint)
  └── 9.x (verify)
    └── 10.x (lifecycle PR #1)

Phase 2 (depends on phase 1 merged):
  11.x (RED analytics)
    └── 12.x (GREEN analytics)
  13.x (RED report)
    └── 14.x (GREEN report)
  └── 15.x (verify)
    └── 16.x (refactor if needed)
    └── 17.x (lifecycle PR #2)
```

## Rollback Plan

Phase 1 ships the schema + plumbing. Reverting it means the migration `down` drops the `timezone` column; tokens fall back to no-`timezone` claim; consumers don't break because phase 2 hasn't landed yet.

Phase 2 wires consumers. Reverting it leaves the foundation in place; analytics/report fall back to container TZ (today's behavior). No data loss.
