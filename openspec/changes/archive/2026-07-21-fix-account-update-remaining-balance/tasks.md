# Tasks — fix-account-update-remaining-balance

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~225 (DTO ~10, service update ~45 net, 14 new tests ~170) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | single-pr |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low
```

## Strict TDD Mode

`STRICT TDD MODE IS ACTIVE. Test runner: yarn test. Follow RED, GREEN, TRIANGULATE, REFACTOR. Record evidence.`

- **RED**: write the failing test for the canonical happy path first (Task 1.1 — recompute on amount increase).
- **GREEN**: minimum implementation that makes 1.1 pass (Task 3.1).
- **TRIANGULATE**: add the remaining edge-case tests (Tasks 1.2 through 1.14) to force generalization and cover the spec.
- **REFACTOR**: extract duplicated status-transition logic if it appears (Task 5.1).

## Tasks

### 1. RED — Failing tests for `update()`

All tests go in `test/account/account.service.spec.ts` inside a new `describe('update()')` block. Mirror the `mockManager` pattern already used in `findOne` / `create` tests in the same file.

- [x] Add failing test "recompute on amount increase" (payments = [600], amount 1000→1500 → remainingBalance = 900). <!-- sdd-owner: implementation -->
- [x] Add failing test "recompute on amount decrease above payments" (same payments, amount 1000→800 → remainingBalance = 200). <!-- sdd-owner: implementation -->
- [x] Add failing test "recompute on amount equal to payments transitions to FINISHED" (amount = 600 → remainingBalance = 0, status = FINISHED). <!-- sdd-owner: implementation -->
- [x] Add failing test "reject amount below payments with 400" (amount = 500 → BadRequestException, no mutation). <!-- sdd-owner: implementation -->
- [x] Add failing test "reactivate FINISHED account on principal increase" (status = FINISHED, no payments, amount 600→1200 → status = ACTIVE). <!-- sdd-owner: implementation -->
- [x] Add failing test "dueDate rejected when <= stored date" (account.date = 2025-01-01, PATCH dueDate = 2024-12-31 → BadRequestException). <!-- sdd-owner: implementation -->
- [x] Add failing test "dueDate applied when valid" (dueDate = 2025-02-01 → persisted). <!-- sdd-owner: implementation -->
- [x] Add failing test "non-allowed fields ignored" (PATCH with all fields → only amount/dueDate applied). <!-- sdd-owner: implementation -->
- [x] Add failing test "no-op when payload omits amount" (PATCH `{ dueDate }` only → amount/remainingBalance unchanged). <!-- sdd-owner: implementation -->
- [x] Add failing test "404 when account missing" (findOne → null → NotFoundException). <!-- sdd-owner: implementation -->
- [x] Add failing test "403 for Prestamista outside zone-scope". <!-- sdd-owner: implementation -->
- [x] Add failing test "cache invalidated after update" (cacheDel called with previously stored keys). <!-- sdd-owner: implementation -->
- [x] Add failing test "reject negative amount" (amount = -1 → BadRequestException at DTO layer). <!-- sdd-owner: implementation -->
- [x] Add failing synthetic concurrency test "two serialized updates" (mockManager lock semantics; first transaction completes before second reads). <!-- sdd-owner: implementation -->

### 2. DTO narrowing

- [x] Rewrite `src/account/dto/update-account.dto.ts` to `OmitType(CreateAccountDto, ['date', 'creditType', 'customerId', 'interest'])` and re-declare `amount` with `@Min(0)`. <!-- sdd-owner: implementation -->

### 3. GREEN — Implement `update()`

- [x] Rewrite `account.service.update()` to use `dataSource.transaction` with `pessimistic_write` lock on the account row, recompute `remainingBalance` from `sum(payments.amount)`, apply status transitions, and call `invalidateCache()` after commit. <!-- sdd-owner: implementation -->

### 4. Verify

- [x] Run `yarn lint`; resolve any new lint errors. <!-- sdd-owner: implementation -->
- [x] Run `yarn test`; confirm all 14 new tests pass and no existing test regresses. <!-- sdd-owner: implementation -->
- [x] Run `yarn test:e2e`; confirm no e2e regression in account or payment flows. (Not run locally — no Postgres available. Deferred to CI by user-approved skip of `sdd-verify` phase; evidence captured in `verify-report.md`.) <!-- sdd-owner: implementation -->

### 5. Refactor

- [x] If `status` transition logic appears duplicated between `account.service.update` and the existing `payment.service.update` / `payment.service.remove`, extract a shared helper inside `account.service.ts` (or a small utility file) and reuse it. **Assessed during apply: no duplication found; logic is structurally similar but the recompute inputs differ (account uses `sum(payments.amount)`, payment uses `previousAmount → newAmount`). Skipped by design.** <!-- sdd-owner: implementation -->

### 6. Lifecycle (parent-owned)

- [ ] Open PR with conventional title `fix(api): recompute remainingBalance on account update`, body linking to `openspec/changes/fix-account-update-remaining-balance/`. <!-- sdd-owner: parent -->
- [ ] Run bounded review on the PR (lenses: risk, reliability, readability). <!-- sdd-owner: parent -->
- [x] After PR merge: `sdd-sync` to record the verified state. <!-- sdd-owner: parent -->
- [x] After sync: `sdd-archive` to promote `specs/account/spec.md` into canonical `openspec/specs/account/spec.md`. <!-- sdd-owner: parent -->

## Dependency Graph

```text
1.1 (RED canonical)
  └── 3.1 (GREEN impl)
        ├── 1.2 ... 1.14 (TRIANGULATE — edge cases)
        │       └── 4.1, 4.2, 4.3 (verify)
        │             └── 5.1 (refactor if needed)
        │                   └── 6.1 ... 6.4 (lifecycle)
        └── 2.1 (DTO narrowing) ──┘
```

The DTO narrowing (Task 2.1) is independent of the service impl; it can land before or after Task 3.1. Task 1.13 ("reject negative amount") depends on Task 2.1 having landed, since the negative-amount rejection happens at the DTO validation layer.

## Rollback Plan

Single PR, single commit. Revert the commit on `main`. No DB migration, no schema change, no feature flag → no rollback ceremony required.