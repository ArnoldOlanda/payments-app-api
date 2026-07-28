# Design: Enforce one payment per account day and operational account visibility

## Architecture decision

The API owns both the payment invariant and pagination-aware eligibility. Account lifecycle remains unchanged: `finished` is the historical state, while mobile and web select operational subsets through query parameters.

```text
payment create/update
  -> lock account inside transaction
  -> calculate Lima day boundaries
  -> search for another live payment in account/day
  -> reject 409 or continue existing balance/status logic

mobile active credits
  -> GET /account?status=active&status=overdue&collectibleToday=true
  -> API NOT EXISTS payment in current Lima day
  -> paginate eligible rows

web accounts
  -> GET /account?status=active&status=overdue&status=cancelled
  -> finished credits remain available from customer history
```

## Business-day policy

Introduce one payment-domain constant:

```ts
const PAYMENT_BUSINESS_TIMEZONE = 'America/Lima';
```

For a candidate payment date:

```ts
const from = dayStart(candidateDate, PAYMENT_BUSINESS_TIMEZONE);
const to = dayEnd(candidateDate, PAYMENT_BUSINESS_TIMEZONE);
```

The account/day key is therefore the account UUID plus the date observed in Lima. Actor timezone is intentionally not used because the invariant must be identical for every writer.

## Duplicate-payment assertion

Add a private `PaymentService` helper that accepts:

- transactional `EntityManager`;
- `accountId`;
- candidate `Date`;
- optional payment ID to exclude during update.

The helper searches `Payment` with:

- matching `accountId`;
- `date` between Lima day start and end;
- `deletedAt IS NULL`;
- `id != excludedPaymentId` when editing.

If a row exists, throw:

```ts
new ConflictException(
  'Ya existe un pago registrado para esta cuenta en la fecha seleccionada',
);
```

The explicit `deletedAt IS NULL` predicate documents the business meaning even though TypeORM normally excludes soft-deleted rows.

### Create ordering

Inside the existing transaction:

1. Lock account pessimistically.
2. Validate account existence and zone access.
3. Assert no live payment exists for `createPaymentDto.date`.
4. Preserve finished-account and overpayment validations.
5. Persist payment/account with current applied-amount and status rules.

Putting the assertion after the account lock serializes competing API requests. Putting it before finished-account rejection gives a deterministic daily-conflict response when today's first payment also finished the account; a finished account without a duplicate still receives the existing finished-account error.

### Update ordering

Inside the existing transaction:

1. Lock payment.
2. Reject account transfer.
3. Lock account.
4. If `date` is supplied, assert uniqueness for the candidate date while excluding the current payment ID.
5. Preserve current applied-amount, balance, overpayment, and status recalculation.
6. Save account and payment.

The duplicate assertion occurs before any in-memory account/payment mutation, so a rejected update leaves state unchanged.

### Delete behavior

No new delete logic is required. Existing soft deletion causes future duplicate lookups and collection eligibility queries to ignore the removed payment. Existing balance restoration/status reopening remains authoritative.

## Account query contract

Extend `PaginateAccountDto`:

```ts
@IsOptional()
@Transform(({ value }) => value === true || value === 'true')
@IsBoolean()
collectibleToday?: boolean;
```

`AccountService.findAll` computes current Lima boundaries only when this flag is true and adds a correlated `NOT EXISTS` condition before ordering and pagination:

```sql
NOT EXISTS (
  SELECT 1
  FROM payment daily_payment
  WHERE daily_payment."accountId" = account.id
    AND daily_payment."deletedAt" IS NULL
    AND daily_payment.date BETWEEN :todayStart AND :todayEnd
)
```

The flag composes with existing status, zone, and actor-zone predicates. Omitting or setting it false preserves current behavior.

## Mobile design

Extend `Pagination` with `collectibleToday?: boolean` and serialize it only when provided. `ActiveCreditsList` passes `collectibleToday: true` together with `active`/`overdue` statuses.

No client-side filtering or new local payment cache is introduced. Existing post-payment and delete-payment refresh calls remain responsible for reloading the authoritative queue.

## Web design

Define the operational account status selection in the web account data layer:

```ts
['active', 'overdue', 'cancelled']
```

Every `useAccountStore.fetchAccounts` request includes those repeated status parameters. Because initial load, zone changes, page changes, row-limit changes, and mutation refreshes all use this store action, the visibility rule remains consistent.

`CustomerCreditsModal` is intentionally unchanged and continues filtering customer credits to `finished`.

## Persistence and migration

No schema migration is required. The current account lock plus duplicate lookup provides concurrency-safe enforcement for all API writers without rewriting historical data.

A partial unique database index is deferred because existing same-day duplicates have not been audited. Adding it now could make deployment fail. A future hardening change may audit historical rows and add an immutable Lima-day key/index.

## Error and compatibility contract

- Duplicate account/day: HTTP `409 Conflict` with Spanish domain message.
- Existing validation and authorization errors retain their current status codes.
- `collectibleToday` is optional, so old clients remain compatible.
- Web and mobile API response shapes do not change.

## Testing strategy

### Strict TDD: API

1. RED payment tests for duplicate create, boundary dates, deleted payment, same-day self update, and occupied-day update.
2. GREEN duplicate helper and create/update integration.
3. TRIANGULATE with finished account, overpayment, and adjacent Lima-day cases.
4. REFACTOR duplicate query construction and constants.
5. RED account query tests for `collectibleToday`, parameters, and default behavior.
6. GREEN account filter; TRIANGULATE with status/zone/pagination predicates.

### Clients

- Mobile: test query serialization with a mocked API client, then wire active list.
- Web: preserve the repository's current verification model (TypeScript build and ESLint); no new test framework is introduced.
- Run full API unit/e2e suites and client build/type/lint commands after focused checks.

## Review boundaries

Expected authored production/test change: approximately 220–340 lines across three repositories.

| Work unit | Expected lines | Boundary |
| --- | ---: | --- |
| API invariant/filter/tests | 170–260 | Independent backend contract |
| Mobile query adoption/test | 30–55 | Optional API flag consumer |
| Web operational statuses | 20–35 | Existing API status consumer |

The total is expected to stay below the confirmed 400-line budget. If implementation exceeds 400 authored lines, stop before widening scope and report the actual split. No commits are authorized.

## Action context

- Authoritative planning root: `E:/work/payments_app/api/openspec/changes/enforce-one-payment-per-account-day`.
- Implementation workspace: `E:/work/payments_app`.
- Explicit edit scope: API source/tests/OpenSpec, mobile source/tests, web source.
- Repositories must be written sequentially.

## Phase result

- status: success
- next_recommended: tasks
- risks: legacy duplicates, transaction ordering, SQL alias correctness, client verification gaps
- skill_resolution: none (no matching project-specific skill; cognitive document design applied by parent)
