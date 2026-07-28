# Exploration: Enforce one payment per account day and operational visibility

## Executive summary

The change should remain an API-owned business invariant with server-side list filters. No `archived` account status is needed: `finished` remains the lifecycle truth, while mobile and web request the operational subsets they need.

## Confirmed business contract

| Topic | Decision |
| --- | --- |
| Business timezone | `America/Lima` |
| Daily limit | One non-deleted payment per account per calendar day |
| Actors | Applies to every role and client, including administrators and web |
| Historical dates | The limit uses the selected `payment.date`, not only server "today" |
| Deleted payments | A soft-deleted payment releases that account/day slot |
| Web account list | Hide only `finished`; keep `active`, `overdue`, and `cancelled` |
| Customer history | Continue showing finished credits and their payments |

## Current implementation seams

### API

- `src/payment/payment.service.ts` creates, updates, and deletes payments inside transactions.
- Payment creation already obtains a pessimistic write lock on the account, so a same-day duplicate check performed after that lock is concurrency-safe for API writers.
- Payment update locks both payment and account rows and can reuse the same duplicate-day rule while excluding the edited payment.
- Payments use soft deletion through `deletedAt`; normal TypeORM reads omit deleted rows unless explicitly requested.
- `src/common/datetime/tempo.ts` already provides timezone-aware `dayStart` and `dayEnd` helpers.
- `GET /account` accepts repeated status query parameters and paginates in the database.

### Mobile

- `Credit/components/ActiveCreditsList.tsx` requests `active` and `overdue` accounts.
- A partial payment leaves an account active, so it remains visible today.
- The payment registration flow already refreshes active credits after success.
- Filtering after pagination would produce short pages and incorrect totals; eligibility must be applied by the API.

### Web

- `src/services/account.service.ts` currently requests all statuses from `GET /account`.
- `AccountView` uses API pagination metadata directly.
- `CustomerCreditsModal` independently fetches customer credits and filters `finished`, so excluding finished accounts from the main list does not remove history access.

## Recommended design direction

1. Add an API-level duplicate-day assertion used by payment create and date-changing update operations.
2. Compute day boundaries from `payment.date` in `America/Lima`.
3. Add a semantic account query flag, `collectibleToday=true`, implemented as a database `NOT EXISTS` payment subquery for the current Lima day.
4. Make mobile active credits request `collectibleToday=true`.
5. Make web accounts request statuses `active`, `overdue`, and `cancelled` explicitly.
6. Preserve existing lifecycle transitions and customer history behavior.

## Risks

- Checking duplicates outside the account lock would allow concurrent requests to race.
- Actor-specific timezones would make one account/day mean different things to different users.
- Client-side filtering would break pagination.
- Payment date updates could bypass the invariant unless they perform the same check and exclude the current payment.
- Adding a database unique index immediately could fail if legacy data already contains same-day duplicates; application enforcement can ship without mutating historical records.

## Action context

- Mode: `workspace-planning` with explicit implementation scope approved by the user.
- Workspace root: `E:/work/payments_app`.
- Allowed edit roots:
  - `api/src`
  - `api/test`
  - `api/openspec`
  - `mobile/Credit`
  - `mobile/interfaces`
  - `mobile/app`
  - `web/src`
- Git repositories are independent and must be changed sequentially.
- No commits are authorized.

## Phase result

- status: success
- next_recommended: proposal
- skill_resolution: none (no project-specific skill matched; package documentation skill applied by the parent)
