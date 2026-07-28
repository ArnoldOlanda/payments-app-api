# Tasks: Enforce one payment per account day and operational visibility

## 1. API payment invariant

- [x] Add focused RED tests for duplicate payment creation on the same Lima day, adjacent Lima days, and UTC instants resolving to the same Lima date. <!-- sdd-owner: implementation -->
- [x] Add focused RED tests proving soft-deleted payments release the day and payment updates exclude themselves but reject an occupied target day. <!-- sdd-owner: implementation -->
- [x] Implement the transactional duplicate-day assertion with `America/Lima` boundaries and `409 Conflict`, preserving account locks, access checks, overpayment, balance, and status behavior. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE and REFACTOR payment tests and helper behavior, recording focused RED/GREEN evidence. <!-- sdd-owner: implementation -->

## 2. API collectible-today account filter

- [x] Add RED DTO/service tests for parsing `collectibleToday` and applying a paid-today exclusion before pagination while preserving default behavior. <!-- sdd-owner: implementation -->
- [x] Implement `collectibleToday` in `PaginateAccountDto` and `AccountService.findAll` with a live-payment `NOT EXISTS` query using current Lima day boundaries. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE the filter with statuses, zone filters, actor zone scope, soft-deleted payments, ordering, and pagination metadata. <!-- sdd-owner: implementation -->

## 3. Mobile active-credit eligibility

- [x] Add a focused RED mobile service test for `collectibleToday` query serialization using the existing Jest setup. <!-- sdd-owner: implementation -->
- [x] Extend mobile pagination/service contracts and make `ActiveCreditsList` request `collectibleToday=true` only for the active/overdue queue. <!-- sdd-owner: implementation -->
- [x] Run the focused mobile test and verify existing refresh flows continue to rely on server eligibility. <!-- sdd-owner: implementation -->
- [x] Refactor `getCreditsService` to use Axios `params` with unindexed array serialization instead of query-string concatenation. <!-- sdd-owner: implementation -->

## 4. Web finished-account archival

- [x] Extend the web account request contract to serialize repeated operational statuses (`active`, `overdue`, `cancelled`). <!-- sdd-owner: implementation -->
- [x] Make every `useAccountStore.fetchAccounts` path use the operational status selection while leaving `CustomerCreditsModal` unchanged. <!-- sdd-owner: implementation -->
- [x] Verify initial load, zone, pagination, rows-per-page, and mutation refreshes retain the status selection through the shared store action. <!-- sdd-owner: implementation -->
- [x] Refactor web `getAccounts` to use Axios `params` with unindexed array serialization instead of query-string concatenation. <!-- sdd-owner: implementation -->

## 5. Shared strict boolean query parsing refactor

- [x] Add RED tests proving class-transformer boolean coercion turns customer `all=false` into `true` and accepts unsupported truthy strings. <!-- sdd-owner: implementation -->
- [x] Add reusable strict `@ToBoolean()` transformation tests for boolean strings, native booleans, omitted values, and invalid values. <!-- sdd-owner: implementation -->
- [x] Replace the inline account transform and unsafe customer `@Type(() => Boolean)` usage with the shared decorator. <!-- sdd-owner: implementation -->
- [x] Run focused tests, full API unit tests, API build, and changed-file lint after the refactor. <!-- sdd-owner: implementation -->

## 6. Verification and artifacts

- [x] Run focused API tests, then full API unit tests, API build, and API e2e tests; record exact results. <!-- sdd-owner: implementation -->
- [x] Run mobile focused tests, typecheck, and lint; record exact results and any pre-existing failures separately. <!-- sdd-owner: implementation -->
- [x] Run web build and lint; record exact results and any pre-existing failures separately. <!-- sdd-owner: implementation -->
- [x] Inspect combined diffs across all three repositories, confirm no unauthorized files or commits, and record actual review workload. <!-- sdd-owner: implementation -->
- [x] Update `apply-progress.md`, `verify-report.md`, and task checkboxes with strict TDD and verification evidence. <!-- sdd-owner: implementation -->

## Review Workload Forecast

| Work unit | Forecast |
| --- | ---: |
| API behavior and tests | 170–260 lines |
| Mobile service/list and test | 30–55 lines |
| Web service/store | 20–35 lines |
| Total authored implementation | 220–350 lines |

Decision needed before apply: No

Chained PRs recommended: No

Chain strategy: feature-branch-chain

400-line budget risk: Medium

Delivery resolution: `auto-forecast` confirmed by the user. The original feature implementation was 365 added lines; the explicitly requested strict-boolean refactor raises the functional surface to 484 added lines. Future delivery must therefore be split by repository and keep the boolean-parser refactor as its own API work unit. No commits are authorized.

## Strict TDD forwarding

STRICT TDD MODE IS ACTIVE for the API. Test runner: `yarn test`. RED, GREEN, TRIANGULATE, and REFACTOR evidence is recorded in `apply-progress.md`.

## Phase result

- status: implementation-complete
- next_recommended: user-manual-test
- risks: configured verify gate remains partial because of documented pre-existing e2e/typecheck/lint failures
- skill_resolution: none; parent fallback used because no subagent runtime was exposed
