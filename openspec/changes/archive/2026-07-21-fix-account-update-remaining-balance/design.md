# Design — fix-account-update-remaining-balance

Implements the spec at `openspec/changes/fix-account-update-remaining-balance/specs/account/spec.md`.

## Affected Files

| Path | Change |
|---|---|
| `src/account/account.service.ts` | Rewrite `update()` to recompute balance + lock + status transitions |
| `src/account/dto/update-account.dto.ts` | Narrow via `OmitType` to `amount` + `dueDate` only |
| `test/account/account.service.spec.ts` | Add `describe('update()')` block (13 cases) |

No DB schema change. No module reconfiguration. No new dependency.

## Data Flow — `account.service.update()`

### Transaction body (`this.dataSource.transaction(async (manager) => { ... })`)

1. **Load with lock.** `manager.createQueryBuilder(Account, 'account')` with `.setLock('pessimistic_write', undefined, ['account'])` and `.leftJoinAndSelect('account.customer', 'customer').leftJoinAndSelect('customer.zone', 'zone').leftJoinAndSelect('account.payments', 'payments')`. Filter soft-deleted payments at the join level (`andWhere('payments.deletedAt IS NULL')`).
2. **404 if missing.**
3. **Zone-scope check** (admin bypass), same as today.
4. **Compute `sumOfPayments`** from `account.payments` (already filtered). Use a simple reduce; the list is bounded by the account's payment history.
5. **If `updateAccountDto.amount !== undefined`:**
   - If `amount < sumOfPayments` → throw `BadRequestException` with both numbers in the message. **No mutation** to the account.
   - `account.amount = amount`
   - `account.remainingBalance = amount - sumOfPayments`
6. **If `updateAccountDto.dueDate !== undefined`:**
   - If `dueDate <= account.date` → throw `BadRequestException`. **No mutation.**
   - `account.dueDate = dueDate`
7. **Status transition** (apply even if `amount` was not provided but `remainingBalance` was somehow mutated — defensive):
   - `remainingBalance === 0` → `FINISHED`.
   - `status === FINISHED && remainingBalance > 0` → `ACTIVE`.
8. **`await manager.save(account)`** within the transaction. Do NOT use `preload` — `preload` rebuilds the entity from the DTO and loses the relations we just loaded. We mutate the loaded entity in place.

### After commit

9. `await this.invalidateCache()`. Outside the transaction, so a failed transaction does not wipe the cache.

### Why this order

- Lock + transaction → prevents the race that today lets a `payment.create` and an `account.update` interleave and produce inconsistent balances.
- Validate-then-mutate → on rejection, the transaction short-circuits via the thrown exception; the lock is released; no partial state ever reaches the DB.
- `invalidateCache` outside the transaction → if the DB save fails, the cache stays valid.

## DTO Narrowing

`update-account.dto.ts` becomes:

```ts
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateAccountDto } from './create-account.dto';
import { IsNumber, Min } from 'class-validator';

export class UpdateAccountDto extends PartialType(
  OmitType(CreateAccountDto, ['date', 'creditType', 'customerId', 'interest'] as const),
) {
  @IsNumber()
  @Min(0, { message: 'El monto no puede ser negativo' })
  amount?: number;
}
```

`PartialType` keeps `@IsOptional()` on the remaining fields. `OmitType` drops the four excluded fields entirely from the DTO; clients sending them get them silently stripped before reaching the service.

`@IsAfter('date')` from `CreateAccountDto` is NOT inherited on `dueDate` because `date` is no longer in the DTO. The `dueDate > account.date` rule moves into the service (step 6 above) where we have access to the loaded entity. **Spec Requirement 8 is satisfied.**

`amount` is re-declared to add `@Min(0)`. Defensive guardrail: a client sending `amount = -100` is rejected with `400` at the DTO layer (spec Scenario "Reject negative amount"). `class-transformer`'s `PartialType` would otherwise keep the inherited validator chain; redeclaring with `@Min(0)` appends the new constraint.

## Cross-Domain Contract

`payment.service.update()` already does almost exactly this recompute. After this change, `account.service.update()` follows the same shape. Both will use:

```ts
.setLock('pessimistic_write', undefined, ['account'])
```

Lock acquisition order is identical in both services → no deadlock risk. If a future change adds a second lock (e.g., on `payment`), it must acquire `account` first to preserve this invariant.

`payment.service.create()` already invalidates the account cache. With this change, `account.service.update()` will too. No double-invalidation concern — `invalidateCache` is idempotent.

## Test Plan — `account.service.spec.ts`

A new `describe('update()')` block, mirroring the style already used by `findOne()` / `create()` / `findAll()`.

| # | Case | What it asserts |
|---|---|---|
| 1 | recompute on amount increase | `payments = [600]`, `amount` 1000→1500 → `remainingBalance = 900` |
| 2 | recompute on amount decrease above payments | same payments, `amount` 1000→800 → `remainingBalance = 200` |
| 3 | recompute on amount equal to payments | same payments, `amount` = 600 → `remainingBalance = 0` + `FINISHED` |
| 4 | reject amount below payments | `amount` = 500 → `400`, no mutation |
| 5 | reactivate FINISHED | `status = FINISHED`, no payments, `amount` 600→1200 → `ACTIVE` |
| 6 | dueDate validates against stored date | `account.date = 2025-01-01`, PATCH `dueDate = 2024-12-31` → `400` |
| 7 | dueDate applied when valid | `dueDate = 2025-02-01` → persisted |
| 8 | non-allowed fields ignored | PATCH with `customerId, creditType, date, interest` → only amount/dueDate applied |
| 9 | no-op on payload without `amount` | PATCH `{ dueDate }` only → `amount, remainingBalance` unchanged |
| 10 | 404 when account missing | `findOne → null` → `NotFoundException` |
| 11 | 403 for Prestamista outside zone-scope | existing helper |
| 12 | cache invalidation after commit | `cacheDel` called with previously stored keys |
| 13 | concurrency: two serialized updates | synthetic lock test (see below) |

## Concurrency Test (case 14) — Approach

Two options were considered:

**Option A — Synthetic mock-based** (proposed):
Reuse the `mockManager` pattern from `payment.service.spec.ts`. Simulate two transactions: the first acquires the lock and runs to completion; the second begins but blocks on the lock until the first commits. Assert the second's read sees the first's writes.

- Cost: ~30 lines added to the spec.
- Coverage: proves the lock is taken; does NOT prove Postgres actually serializes two real queries.

**Option B — Real e2e** (not proposed):
Two parallel HTTP `PATCH /account/:id` calls in a `test/jest-e2e.json` test. Requires a running Postgres in CI.

- Cost: ~80 lines + CI plumbing.
- Coverage: end-to-end serialization under a real DB.

**Decision proposed: Option A.** Smaller PR, fits the unit-test rhythm already in the spec. If the user wants the heavier Option B, we add it as a follow-up.

## Rollout

1. Land in a feature branch off `main` (or the team's default).
2. Local: `yarn lint`, `yarn test`, `yarn test:e2e`.
3. PR title follows `work-unit-commits` guidance (one focused commit, conventional message).
4. After merge: no backfill, no migration, no feature flag. Existing accounts in production remain with whatever `remainingBalance` they have; product reconciles manually.

## Open Decisions

1. **Concurrency test approach:** Option A (synthetic, proposed) vs Option B (real e2e).
2. ~~Extra DTO hardening: `@Min(0)` on `amount`~~ — added per user request. Closed.
3. **Naming:** keep the change folder `fix-account-update-remaining-balance` or shorten to `fix-account-edit-recompute`? Cosmetic; default is current.