# Proposal: Fix account update — recompute `remainingBalance` and honor existing payments

## Why

`PATCH /account/:id` currently accepts updates to `amount` without recomputing `remainingBalance`. Because `remainingBalance` is a stored column (not derived), editing the principal amount leaves the account in an internally inconsistent state.

Concrete failure:

- Account has `amount = 1000`, `remainingBalance = 400` (client has already paid 600).
- Operator edits `amount` to `1500`.
- Stored result: `amount = 1500`, `remainingBalance = 400`.
- Expected result: `amount = 1500`, `remainingBalance = 900` (1500 − 600).

Business risks this creates:

1. **Reporting drift.** Cobranzas and report modules read `remainingBalance` as the source of truth for "lo que falta cobrar". The bug inflates collection totals and breaks "clientes del día" reporting.
2. **Overpayment enabler.** `payment.service.create` only checks `account.remainingBalance < amount`. With the bug, a new payment can be created for the inflated residual (e.g., a 400 payment on a real 900 outstanding). Money moves and the books desync further.

The fix aligns `account.service.update` with the pattern already used by `payment.service`: sum payments, recompute balance, transition status under a row lock.

## What Changes

- `account.service.update` recomputes `remainingBalance` as `newAmount − sum(payments.amount)` for the account, inside a `dataSource.transaction` with `pessimistic_write` on the account row (mirroring `payment.service`).
- The update is rejected with `400 Bad Request` when `newAmount < sum(payments.amount)` — the new principal would be smaller than what has already been collected.
- After recompute, `status` transitions automatically, mirroring `payment.service.update`:
  - `remainingBalance === 0` → `FINISHED`.
  - `FINISHED` and `remainingBalance > 0` → `ACTIVE`.
- `UpdateAccountDto` is narrowed: only `amount` and `dueDate` are accepted. `date`, `creditType`, `customerId`, and `interest` are silently dropped (excluded-field validation) so existing clients that send the full DTO keep working without a 400 storm.
- `dueDate` edit, when present, must satisfy the existing `dueDate > date` rule (already enforced by the `@IsAfter('date')` decorator on `CreateAccountDto`).
- Cache invalidation runs after the transaction commits, as today.
- Test coverage for `account.service.update` is added to `test/account/account.service.spec.ts` (currently zero coverage on this method).

## Impact

- **API behavior change.** `PATCH /account/:id` with `amount` now produces different `remainingBalance` than before. Clients that compute balance client-side from prior responses may need a refresh.
- **Locked-out edits.** Calls that try to lower `amount` below the already-collected sum will now fail. This is intentional and matches the financial rule.
- **No-op fields.** `date`, `creditType`, `customerId`, `interest` become no-ops on update. Today they accept and overwrite. This is a breaking change for any caller that relies on updating them; the proposal accepts that risk for `date`/`creditType`/`customerId` and explicitly excludes `interest` from scope.
- **Performance.** One extra read (`account.payments`) and one extra row lock per update. Negligible at expected load.
- **No DB schema change.** No new column, no new index. The fix is purely service-layer.

## Out of Scope

- `interest` recompute or any change to "total to collect" semantics (`interest` remains a static, freely editable field via update, until a separate change revisits it).
- Backfill / migration of existing production accounts that may have inconsistent `remainingBalance` due to this bug. Confirmed by product: few accounts affected, reconciled manually outside this change.
- Changes to `account.service.create` (already correct).
- Changes to `payment.service` (already correct).
- Changes to the cron `handleCron` (already correct).
- New endpoints, new columns, audit trail of edits.

## Affected Files (proposed; to be refined in `design`)

- `src/account/account.service.ts` — `update()` rewritten.
- `src/account/dto/update-account.dto.ts` — narrowed via `@OmitType` or custom class.
- `src/account/account.module.ts` — no structural change expected; verify.
- `test/account/account.service.spec.ts` — new `describe('update()', ...)` block.
- `test/payment/payment.service.spec.ts` — confirm no regression.
- No migration file (Q5 = B).

## Acceptance Criteria (draft; finalized in `spec`)

- `PATCH /account/:id` with `amount` recomputes `remainingBalance` to `newAmount − sum(payments.amount)`.
- `PATCH /account/:id` with `amount < sum(payments.amount)` returns `400 Bad Request` with a clear message naming both numbers.
- `PATCH /account/:id` with `amount === sum(payments.amount)` produces `remainingBalance === 0` and transitions `status` to `FINISHED`.
- `PATCH /account/:id` on a `FINISHED` account whose `newAmount > sum(payments.amount)` transitions `status` back to `ACTIVE`.
- `PATCH /account/:id` with `dueDate <= date` returns `400 Bad Request`.
- `PATCH /account/:id` with `date`, `creditType`, `customerId`, or `interest` does not modify those fields, and the rest of the update still applies.
- Two concurrent updates on the same account do not corrupt `remainingBalance` (verified by a concurrency test using the same lock pattern as `payment.service`).
- Cache keys produced by `findAll` and `getAccountsByCustomer` are invalidated after the update commits.
- New tests in `test/account/account.service.spec.ts` cover every bullet above.
- `yarn test` and `yarn test:e2e` pass with no regression in `payment.service.spec.ts`.

## Open Questions

None remaining. All product decisions resolved in preflight.