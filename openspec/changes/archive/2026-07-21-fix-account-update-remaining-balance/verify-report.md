# Verify Report — fix-account-update-remaining-balance

**status:** passing (user-approved skip of dedicated verify phase; evidence below)
**decision:** user explicitly approved skipping `sdd-verify` ("saltemos verify") and proceeding to sync + archive.
**scope:** `api/` subproject.

## Evidence collected during `sdd-apply`

### Unit + integration suite

```
yarn test --no-coverage
Test Suites: 11 passed, 11 total
Tests:       144 passed, 144 total
Snapshots:   0 total
Time:        29.641 s
```

Breakdown per suite:

| Suite | Tests | Result |
|---|---|---|
| `test/account/account.service.spec.ts` | 30 (16 pre-existing + 14 new in `describe('update()')`) | PASS |
| `test/payment/payment.service.spec.ts` | 27 (was 11 failing pre-existing, fixed during apply) | PASS |
| `test/auth/auth.controller.spec.ts` | — | PASS |
| `test/auth/services/password-reset.service.spec.ts` | — | PASS |
| `test/customer/customer.service.update.spec.ts` | — | PASS |
| `test/mail/mail.service.spec.ts` | — | PASS |
| (5 more suites) | — | PASS |

### Lint

`yarn lint` ran clean for files modified by this change:

- `src/account/dto/update-account.dto.ts` — clean
- `src/account/account.service.ts` — clean
- `test/account/account.service.spec.ts` — clean
- `test/payment/payment.service.spec.ts` — clean (mock enhancement only)

17 pre-existing lint errors in files NOT modified by this change remain (`auth/`, `customer/`, `files/`, `interfaces/`, `report/`, `user/`). Out of scope; flagged for a separate change.

### E2E suite

`yarn test:e2e` was NOT executed during apply (no local Postgres available). This is the primary residual risk. The e2e suite should be exercised by the team's CI pipeline before merging the PR.

## Strict TDD trace

| Phase | Evidence |
|---|---|
| RED | Task 1.1 test "recompute on amount increase" failed against the original `update()` implementation, confirming the bug. |
| GREEN | `account.service.update()` rewritten with transaction + `pessimistic_write` lock + recompute + status transitions; Task 1.1 passes. |
| TRIANGULATE | Tasks 1.2–1.14 (13 additional tests covering decrease, equal-to-payments, rejection, status reactivation, dueDate validation, ignored fields, no-op, 404, 403, cache invalidation, cache preservation on throw, lock semantics) all pass. |
| REFACTOR | Task 5.1 skipped: no status-transition logic duplication was introduced. |

## Acceptance criteria coverage

All 11 acceptance criteria from `proposal.md` are covered by the 14 new tests in `account.service.spec.ts`. Mapping:

| Acceptance criterion | Test |
|---|---|
| Recompute on amount increase | 1.1 |
| Recompute on amount decrease above payments | 1.2 |
| Recompute on amount equal to payments → FINISHED | 1.3 |
| Reject amount below payments with 400 | 1.4 |
| Reactivate FINISHED account on principal increase | 1.5 |
| dueDate rejected when <= stored date | 1.6 |
| dueDate applied when valid | 1.7 |
| Non-allowed fields ignored | 1.8 |
| No-op when amount omitted | 1.9 |
| 404 when account missing | 1.10 |
| 403 for Prestamista outside zone-scope | 1.11 |
| Cache invalidated after update | 1.12 |
| Cache NOT invalidated on transaction throw | 1.13 |
| Transaction with `pessimistic_write` lock | 1.14 |

## Residual risks accepted by user

1. E2E suite not run locally (CI to validate).
2. Pre-existing lint errors in files outside this change's scope.
3. Behavior change in production: `PATCH /account/:id` with `amount` now recomputes `remainingBalance`. Clients computing balance client-side may need refresh.

## Sign-off

Verified-by: `sdd-apply` (user skipped `sdd-verify` phase; evidence auto-collected during apply).
Date: 2026-07-21