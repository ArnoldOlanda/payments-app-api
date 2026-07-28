# Proposal: Enforce one payment per account day and archive finished accounts from operations

## Decision

Make payment-day eligibility an API-enforced invariant and treat account archival as server-side visibility, not as a new lifecycle status.

## Problem

A partially paid account remains `active` or `overdue` and therefore continues to appear in the mobile active-credit queue on the same day. This allows users to attempt multiple daily payments even though the business permits only one payment per account per day.

The web account list also includes `finished` accounts even though completed credit history is already available from each customer's finished-credit view. This mixes operational accounts with historical records.

## Outcome

- Every account has at most one non-deleted payment for each `America/Lima` calendar day.
- The rule applies uniformly to mobile, web, administrators, lenders, current dates, and selected historical dates.
- Mobile's active-credit queue omits accounts that already received a payment today.
- Web's main account view omits only `finished` accounts.
- Finished accounts remain available in customer credit history with their payment details.
- Deleting a payment releases its account/day slot and allows the account to become collectible again when its lifecycle state permits it.

## Scope

### API

- Reject duplicate live payments for the same account and Lima calendar day during create.
- Apply the same rule when an existing payment's date changes, excluding that payment from the duplicate lookup.
- Keep the validation inside existing locked transactions.
- Add a `collectibleToday` account-list query filter that excludes accounts with a live payment in the current Lima day.
- Preserve status, zone authorization, pagination, overpayment, and soft-delete behavior.

### Mobile

- Request `collectibleToday=true` for the active/overdue credit queue.
- Preserve current refresh behavior after payment creation and deletion.
- Keep all-credit and customer-history flows unchanged.

### Web

- Request only `active`, `overdue`, and `cancelled` accounts in the main account view.
- Preserve the existing finished-credit customer history.

### Documentation and verification

- Record strict TDD evidence for API behavior.
- Verify API tests/build, mobile tests/typecheck/lint, and web build/lint.
- Do not create commits; the user will test before authorizing any commit.

## Non-goals

- Add an `archived` account status or archive timestamp.
- Delete, migrate, merge, or otherwise rewrite historical duplicate payments.
- Add an administrator bypass to the daily limit.
- Change payment amount, applied amount, overpayment, account balance, or status-transition semantics.
- Remove `cancelled` accounts from the web account view.
- Redesign customer history or add history pagination in this slice.
- Introduce a new frontend test framework solely for this change.

## Product rules

| Rule | Contract |
| --- | --- |
| Account/day identity | `accountId` plus the calendar date of `payment.date` in `America/Lima` |
| Live payment | A payment whose `deletedAt` is null |
| Duplicate response | HTTP `409 Conflict` with a user-readable Spanish message |
| Today eligibility | Current calendar day in `America/Lima`, computed by the API |
| Finished visibility | Hidden only from the web operational account list |
| Soft delete | Releases the account/day slot |

## Delivery order

1. API contract and behavior.
2. Mobile eligibility query.
3. Web operational status query.
4. Cross-repository verification.

The API change is backward-compatible because `collectibleToday` is optional and existing clients can continue using current queries during rollout.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Concurrent duplicate creates | Perform duplicate lookup after the pessimistic account lock inside the same transaction. |
| Date-boundary errors | Reuse `dayStart`/`dayEnd` with fixed `America/Lima`. |
| Update bypass | Validate date-changing updates and exclude the edited payment ID. |
| Incorrect pagination | Filter in the API query, never after a page is returned. |
| Legacy duplicates | Do not add a unique database index until historical data is audited. |
| Cross-repository drift | Implement API first and verify each client against the optional contract. |

## Rollback

- Remove the optional `collectibleToday` query behavior and client query parameters.
- Remove duplicate-day checks from create/update while preserving existing transactions.
- Restore the web account query without explicit statuses.
- No schema rollback or historical data restoration is required because this change does not alter persistence structure.

## Success criteria

- A second live payment for the same account/Lima day is rejected regardless of client or role.
- Payments on different Lima calendar days remain valid.
- A soft-deleted payment does not block a replacement payment for that day.
- Mobile excludes paid-today active/overdue accounts without corrupting pagination.
- Web excludes `finished` accounts while retaining `cancelled` accounts.
- Customer finished-credit history continues to show finished accounts and payment access.
- Focused and full verification commands pass, with no commits created.

## Phase result

- status: success
- next_recommended: spec-and-design
- risks: concurrency, timezone boundaries, update bypass, pagination
- skill_resolution: none (no matching project-specific skill)
