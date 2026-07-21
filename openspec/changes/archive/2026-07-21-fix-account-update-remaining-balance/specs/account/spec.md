# Account Specification

## Purpose

The `account` bounded context represents a credit line issued to a customer within the payments domain. An account carries the principal amount, the residual balance after payments, an origination and due date, an interest rate, a credit type, and a lifecycle status. Accounts are scoped by zone and may carry zero or more payments.

This specification is the first canonical spec for the domain. It defines the accepted behavior of the `AccountService` exposed through `PATCH /account/:id`, `POST /account`, `GET /account`, `GET /account/:id`, `DELETE /account/:id`, the overdue-marking cron, and the supporting cache/access-control contracts.

## Requirements

### Requirement: Account Creation

The system MUST allow `ADMIN` or `PRESTAMISTA` to create a new account for an existing customer.

#### Scenario: Create with valid payload

- GIVEN a customer with id `c-1` exists
- WHEN `POST /account` is called with `customerId = c-1`, `amount = 1000`, `interest = 5`, `creditType = DIARIO`, and valid `date` / `dueDate`
- THEN the response is `201 Created` with the new account
- AND the persisted account has `remainingBalance === amount`
- AND `status` defaults to `ACTIVE`

#### Scenario: Reject when customer does not exist

- GIVEN no customer with the supplied `customerId`
- WHEN `POST /account` is called
- THEN the response is `404 Not Found`

#### Scenario: Reject when dueDate is not after date

- GIVEN any payload where `dueDate <= date`
- WHEN `POST /account` is called
- THEN the response is `400 Bad Request`

#### Scenario: Reject Prestamista whose zones do not include the customer zone

- GIVEN a customer whose `zone` is outside the Prestamista's assigned zones
- WHEN `POST /account` is called by that Prestamista
- THEN the response is `403 Forbidden`

#### Scenario: Allow Admin to skip zone-scope

- GIVEN any customer
- WHEN `POST /account` is called by `ADMIN`
- THEN the response is `2xx` regardless of zone

### Requirement: Account Retrieval by ID

The system MUST allow `ADMIN` or `PRESTAMISTA` to retrieve a single account by its UUID, including its customer (with zone) and payments.

#### Scenario: Return account with relations

- GIVEN an account `a-1` exists
- WHEN `GET /account/a-1` is called
- THEN the response includes `customer.zone` and the `payments` array

#### Scenario: Reject when account does not exist

- GIVEN no account with the supplied id
- WHEN `GET /account/:id` is called
- THEN the response is `404 Not Found`

#### Scenario: Reject Prestamista outside zone-scope

- GIVEN an account whose customer's zone is outside the Prestamista's zones
- WHEN `GET /account/:id` is called by that Prestamista
- THEN the response is `403 Forbidden`

### Requirement: Account Listing with Pagination and Zone-Scope

The system MUST list accounts paginated, filtered by zone for non-admin actors, and MUST cache the result keyed by actor and pagination input.

#### Scenario: Apply zone filter for Prestamista

- GIVEN a Prestamista assigned to zones `[zone-A]`
- WHEN `GET /account?page=1&limit=10` is called
- THEN the query restricts `account.customer.zone.id IN ('zone-A')`

#### Scenario: Skip zone filter for Admin

- GIVEN an `ADMIN` actor
- WHEN `GET /account?page=1&limit=10` is called
- THEN the query does NOT include a zone-id filter

#### Scenario: Short-circuit to empty for Prestamista with no zones

- GIVEN a Prestamista with no assigned zones
- WHEN `GET /account?page=1&limit=10` is called
- THEN the response data is `[]`, meta `total = 0`, and no query is executed against the database

#### Scenario: Cache subsequent identical calls

- GIVEN the same actor and pagination input has been queried within the cache window
- WHEN the same request is repeated
- THEN the cached result is returned without hitting the database

### Requirement: Account Update — Only Amount and Due Date Are Mutable

The system MUST allow `ADMIN` or `PRESTAMISTA` to update an account, but MUST only apply changes to the `amount` and `dueDate` fields. Other fields present in the request body MUST be ignored. The system MUST also reject any update whose `amount` is negative.

#### Scenario: Ignore non-allowed fields

- GIVEN an account `a-1` exists
- WHEN `PATCH /account/a-1` is called with `{ amount, dueDate, date, creditType, customerId, interest }`
- THEN only `amount` and `dueDate` are applied
- AND `date`, `creditType`, `customerId`, `interest` remain at their stored values
- AND the response is `200 OK`

#### Scenario: Reject negative amount

- GIVEN any account
- WHEN `PATCH /account/:id` is called with `amount = -1`
- THEN the response is `400 Bad Request`

### Requirement: Account Update — Recompute Remaining Balance from Payments

The system MUST recompute `remainingBalance` whenever `amount` is updated, using the formula `remainingBalance = newAmount − sum(payments.amount)` over non-soft-deleted payments of the account.

#### Scenario: Recompute on amount increase

- GIVEN an account with `amount = 1000`, `remainingBalance = 400`, and payments summing `600`
- WHEN `PATCH /account/:id` is called with `amount = 1500`
- THEN the persisted account has `amount = 1500` and `remainingBalance = 900`

#### Scenario: Recompute on amount decrease above payments sum

- GIVEN an account with `amount = 1000`, `remainingBalance = 400`, and payments summing `600`
- WHEN `PATCH /account/:id` is called with `amount = 800`
- THEN the persisted account has `amount = 800` and `remainingBalance = 200`

#### Scenario: Recompute on amount decrease to exact payments sum

- GIVEN an account with `amount = 1000`, `remainingBalance = 400`, and payments summing `600`
- WHEN `PATCH /account/:id` is called with `amount = 600`
- THEN the persisted account has `amount = 600` and `remainingBalance = 0`
- AND `status` transitions to `FINISHED`

#### Scenario: Leave remainingBalance unchanged when amount is not in payload

- GIVEN an account with `amount = 1000`, `remainingBalance = 400`
- WHEN `PATCH /account/:id` is called with `{ dueDate }` only
- THEN `amount` and `remainingBalance` remain unchanged

### Requirement: Account Update — Reject Amount Below Sum of Payments

The system MUST reject any update that would set `amount < sum(payments.amount)` with a `400 Bad Request`.

#### Scenario: Reject when new amount is smaller than what was already collected

- GIVEN an account with payments summing `600`
- WHEN `PATCH /account/:id` is called with `amount = 500`
- THEN the response is `400 Bad Request`
- AND the response message names both the proposed `amount` and the current `sum(payments.amount)`
- AND no field of the account is modified

### Requirement: Account Update — Reactivate Finished Accounts When Principal Grows

The system MUST transition `status` from `FINISHED` back to `ACTIVE` when the recompute produces `remainingBalance > 0`.

#### Scenario: Reactivate finished account after principal increase

- GIVEN an account with `status = FINISHED`, `amount = 600`, `remainingBalance = 0`, and no payments
- WHEN `PATCH /account/:id` is called with `amount = 1200`
- THEN `remainingBalance = 1200` and `status = ACTIVE`

### Requirement: Account Update — Due Date Validation Against Stored Date

The system MUST reject an update that sets `dueDate <= account.date`, comparing `dueDate` against the account's stored `date`, not against a `date` field in the request body.

#### Scenario: Reject dueDate earlier than stored date

- GIVEN an account with `date = 2025-01-01`
- WHEN `PATCH /account/:id` is called with `dueDate = 2024-12-31` and no `date` in the body
- THEN the response is `400 Bad Request`

#### Scenario: Accept dueDate later than stored date

- GIVEN an account with `date = 2025-01-01`
- WHEN `PATCH /account/:id` is called with `dueDate = 2025-02-01`
- THEN the response is `200 OK` and `dueDate` is updated

### Requirement: Account Update — Transactional with Row Lock

The system MUST execute account updates inside a database transaction that takes a pessimistic write lock on the target account row, matching the locking discipline already used by the payment service.

#### Scenario: Two concurrent updates do not corrupt remainingBalance

- GIVEN an account with `amount = 1000`, `remainingBalance = 400`, and payments summing `600`
- WHEN two `PATCH /account/:id` requests run concurrently, one with `amount = 1500` and the other with `amount = 2000`
- THEN exactly one transaction proceeds at a time
- AND the final `remainingBalance` equals the last successful `newAmount − 600`

#### Scenario: Concurrent payment creation cannot interleave with account update

- GIVEN an account with `amount = 1000`, `remainingBalance = 400`, and no in-flight transactions
- WHEN a `PATCH /account/:id` and a `POST /payment` for the same account arrive concurrently
- THEN one transaction blocks until the other commits
- AND `remainingBalance` is consistent with both operations

### Requirement: Account Update — Access Control and Cache Invalidation

The system MUST enforce zone-scope on updates and MUST invalidate cached account listings after the update transaction commits.

#### Scenario: Reject Prestamista outside zone-scope

- GIVEN an account whose customer's zone is outside the Prestamista's zones
- WHEN `PATCH /account/:id` is called by that Prestamista
- THEN the response is `403 Forbidden`

#### Scenario: Invalidate cache after successful update

- GIVEN cached entries exist for `accounts:*` and `accountsByCustomer`
- WHEN a `PATCH /account/:id` succeeds
- THEN those cache keys are deleted before the response is returned

### Requirement: Account Deletion — Soft Delete with Cascade

The system MUST soft-delete the target account and all of its payments when `ADMIN` calls `DELETE /account/:id`.

#### Scenario: Delete cascades to payments

- GIVEN an account `a-1` with two payments
- WHEN `DELETE /account/a-1` is called by `ADMIN`
- THEN both payments are soft-deleted
- AND the account is soft-deleted
- AND the response is `200 OK`

#### Scenario: Reject non-admin delete

- GIVEN a non-admin actor
- WHEN `DELETE /account/:id` is called
- THEN the response is `403 Forbidden`

### Requirement: Account Status — Automatic Transitions from Mutations

The system MUST transition `status` automatically on mutation operations:

- When a payment makes `remainingBalance` reach `0` → `FINISHED`.
- When a payment is updated or removed such that `remainingBalance > 0` and current status is `FINISHED` → `ACTIVE`.
- When `account.update` recomputes `remainingBalance = 0` → `FINISHED`.
- When `account.update` recomputes `remainingBalance > 0` and current status is `FINISHED` → `ACTIVE`.

#### Scenario: Payment that zeros the balance finishes the account

- GIVEN an account with `remainingBalance = 100` and `status = ACTIVE`
- WHEN a payment of `100` is created
- THEN `remainingBalance = 0` and `status = FINISHED`

#### Scenario: Payment removal reactivates a finished account

- GIVEN an account with `remainingBalance = 0` and `status = FINISHED`
- WHEN the last payment is removed
- THEN `remainingBalance > 0` and `status = ACTIVE`

### Requirement: Account Cron — Overdue Marking

The system MUST run a daily job at `01:00` that bulk-updates every `ACTIVE` account with `dueDate <= CURRENT_DATE` and a non-null `dueDate` to `FINISHED`.

#### Scenario: Bulk update active accounts past due

- GIVEN three `ACTIVE` accounts with `dueDate` in the past
- WHEN the cron runs
- THEN a single SQL `UPDATE` sets all three to `FINISHED`
- AND the response side-effect (cache) is invalidated only when at least one row changed

#### Scenario: Cron survives transient DB errors

- GIVEN the database is unavailable when the cron runs
- WHEN the cron runs
- THEN the error is logged and the cron completes without throwing

### Requirement: Account Access Control — Zone-Scope

The system MUST restrict all account operations to `ADMIN` (full access) or to actors whose assigned zones include the customer zone of the account.

#### Scenario: Admin bypass

- GIVEN any account
- WHEN any account operation is invoked by `ADMIN`
- THEN the operation is permitted regardless of zone

#### Scenario: Prestamista must own the zone

- GIVEN an account whose customer's zone is outside the actor's zones
- WHEN any account operation is invoked by that actor
- THEN the response is `403 Forbidden`

### Requirement: Account Cache — Key Invalidation Discipline

The system MUST keep a per-process set of cache keys written by account reads and MUST delete all of them on any mutation (`create`, `update`, `delete`, payment mutations that affect accounts, cron transitions).

#### Scenario: Invalidate only on actual change

- GIVEN no cache keys have been written during the current process
- WHEN `invalidateCache()` is invoked
- THEN no cache call is made

#### Scenario: Delete every key previously written

- GIVEN two cache keys were written during the current process
- WHEN `invalidateCache()` is invoked
- THEN both keys are deleted