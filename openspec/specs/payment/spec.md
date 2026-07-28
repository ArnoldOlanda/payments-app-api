# Payment Specification

## Purpose

The `payment` bounded context represents a single monetary collection against an account. A payment is dated, attributed to the user who registered it, and decrements the `remainingBalance` of its parent account. Payments participate in the account status lifecycle: they may drive an account from `ACTIVE` or `OVERDUE` to `FINISHED`, and removing or editing a payment may transition an account from `FINISHED` back to `ACTIVE`.

This specification defines the accepted behavior of the `PaymentService` exposed through `POST /payment`, `GET /payment`, `GET /payment/:id`, `PATCH /payment/:id`, and `DELETE /payment/:id`, including the access-control and status-transition contracts that tie payments to accounts.

## Requirements

### Requirement: Payment Creation

The system MUST allow `ADMIN` or `PRESTAMISTA` to register a payment against an account. The system MUST accept payments against accounts in any status except `FINISHED`. The system MUST require explicit overpayment intent when a payment amount exceeds the account's `remainingBalance`. Confirmed overpayments MUST persist the full payment amount, apply only the remaining balance, and finish the account.

#### Scenario: Register a payment against an active account

- GIVEN an account `a-1` with `remainingBalance = 500` and `status = ACTIVE`
- WHEN `POST /payment` is called with `{ accountId: a-1, amount: 100, date: <now> }`
- THEN the response is `201 Created` with the persisted payment
- AND `a-1.remainingBalance = 400`
- AND `a-1.status` remains `ACTIVE`

#### Scenario: Register a payment against an overdue account (partial)

- GIVEN an account `a-1` with `remainingBalance = 500` and `status = OVERDUE`
- WHEN `POST /payment` is called with `{ accountId: a-1, amount: 100, date: <now> }`
- THEN the response is `201 Created` with the persisted payment
- AND `a-1.remainingBalance = 400`
- AND `a-1.status` remains `OVERDUE` (no transition to `ACTIVE`)

#### Scenario: Register a payment against an overdue account (full)

- GIVEN an account `a-1` with `remainingBalance = 500` and `status = OVERDUE`
- WHEN `POST /payment` is called with `{ accountId: a-1, amount: 500, date: <now> }`
- THEN the response is `201 Created` with the persisted payment
- AND `a-1.remainingBalance = 0`
- AND `a-1.status = FINISHED`

#### Scenario: Register a payment against a cancelled account

- GIVEN an account `a-1` with `remainingBalance = 500` and `status = CANCELLED`
- WHEN `POST /payment` is called with `{ accountId: a-1, amount: 100, date: <now> }`
- THEN the response is `201 Created` (payments are not blocked by `CANCELLED`)
- AND `a-1.remainingBalance = 400`
- AND `a-1.status` remains `CANCELLED`

#### Scenario: Reject payment against a finished account

- GIVEN an account `a-1` with `status = FINISHED`
- WHEN `POST /payment` is called with any positive amount
- THEN the response is `400 Bad Request`
- AND the response message identifies the account id and explains that the account is finished

#### Scenario: Reject payment that exceeds remaining balance

- GIVEN an account `a-1` with `remainingBalance = 100`
- WHEN `POST /payment` is called with `amount = 200`
- THEN the response is `400 Bad Request`
- AND the response message names both the proposed amount and the current remaining balance

#### Scenario: Reject payment for unknown account

- GIVEN no account with the supplied `accountId`
- WHEN `POST /payment` is called
- THEN the response is `404 Not Found`

#### Scenario: Reject Prestamista outside zone-scope

- GIVEN an account whose customer's zone is outside the Prestamista's zones
- WHEN `POST /payment` is called by that Prestamista
- THEN the response is `403 Forbidden`

#### Scenario: Allow Admin to bypass zone-scope

- GIVEN any account
- WHEN `POST /payment` is called by `ADMIN`
- THEN the response is `2xx` regardless of zone

### Requirement: Payment Listing by Account

The system MUST allow `ADMIN` or `PRESTAMISTA` to list all non-soft-deleted payments of a given account.

#### Scenario: Return payments for an account

- GIVEN an account `a-1` with two payments
- WHEN `GET /payment?accountId=a-1` is called
- THEN the response data is the array of the two payments (each with its `user` relation loaded)

#### Scenario: Reject when account does not exist

- GIVEN no account with the supplied `accountId`
- WHEN `GET /payment?accountId=<unknown>` is called
- THEN the response is `404 Not Found`

#### Scenario: Reject Prestamista outside zone-scope

- GIVEN an account whose customer's zone is outside the Prestamista's zones
- WHEN `GET /payment?accountId=<account>` is called by that Prestamista
- THEN the response is `403 Forbidden`

### Requirement: Payment Retrieval by ID

The system MUST allow `ADMIN` or `PRESTAMISTA` to retrieve a single payment by its UUID, including its parent account (with customer and zone).

#### Scenario: Return payment with relations

- GIVEN a payment `p-1` exists
- WHEN `GET /payment/p-1` is called
- THEN the response includes `account`, `account.customer`, and `account.customer.zone`

#### Scenario: Reject when payment does not exist

- GIVEN no payment with the supplied id
- WHEN `GET /payment/:id` is called
- THEN the response is `404 Not Found`

#### Scenario: Reject Prestamista outside zone-scope

- GIVEN a payment whose account customer zone is outside the actor's zones
- WHEN `GET /payment/:id` is called by that actor
- THEN the response is `403 Forbidden`

### Requirement: Payment Update — Only Admin and Only Amount and Date

The system MUST allow `ADMIN` to update a payment, but MUST only apply changes to `amount` and `date` fields. Other fields present in the request body MUST be ignored. The system MUST reject any update that would leave the account's `remainingBalance` negative. The system MUST NOT allow transferring a payment between accounts.

#### Scenario: Update payment amount

- GIVEN a payment of `100` against an account with `remainingBalance = 400`
- WHEN `PATCH /payment/:id` is called with `amount = 150`
- THEN the account's `remainingBalance = 450`
- AND the payment's `amount = 150`

#### Scenario: Reject amount that would leave negative balance

- GIVEN a payment of `100` against an account with `remainingBalance = 50`
- WHEN `PATCH /payment/:id` is called with `amount = 200`
- THEN the response is `400 Bad Request`
- AND no field of the account or payment is modified

#### Scenario: Reject transfer between accounts

- GIVEN any payment
- WHEN `PATCH /payment/:id` is called with an `accountId` different from the payment's current account
- THEN the response is `400 Bad Request`

#### Scenario: Reject negative amount

- GIVEN any payment
- WHEN `PATCH /payment/:id` is called with `amount = -1`
- THEN the response is `400 Bad Request`

#### Scenario: Reject non-admin update

- GIVEN a non-admin actor
- WHEN `PATCH /payment/:id` is called
- THEN the response is `403 Forbidden`

### Requirement: Payment Update — Status Transitions

The system MUST recompute the parent account's status after a payment update, applying the same transitions defined in the account spec:

- When the recompute produces `remainingBalance === 0` → `FINISHED`, regardless of the previous status (`ACTIVE` or `OVERDUE`).
- When the recompute produces `remainingBalance > 0` and the previous status was `FINISHED` → `ACTIVE`.
- The system MUST NOT transition an `OVERDUE` account to `ACTIVE` from a payment mutation (the cron would revert it).

#### Scenario: Updating payment on overdue account to balance zero finishes it

- GIVEN an account with `remainingBalance = 200`, `status = OVERDUE`, and a payment of `50`
- WHEN `PATCH /payment/:id` is called with `amount = 200`
- THEN `remainingBalance = 0` and `status = FINISHED`

#### Scenario: Updating payment on overdue account leaving balance > 0 keeps it overdue

- GIVEN an account with `remainingBalance = 200`, `status = OVERDUE`, and a payment of `50`
- WHEN `PATCH /payment/:id` is called with `amount = 80`
- THEN `remainingBalance = 170` and `status = OVERDUE`

#### Scenario: Updating payment reactivates a finished account

- GIVEN an account with `remainingBalance = 0`, `status = FINISHED`, and one payment
- WHEN `PATCH /payment/:id` is called with `amount = 0` (zeroing the payment)
- THEN `remainingBalance = 0` and `status = FINISHED` (no change, zero is still finished)

### Requirement: Payment Update — Transactional with Row Lock

The system MUST execute payment updates inside a database transaction that takes a pessimistic write lock on both the payment and its parent account rows, matching the locking discipline used by the account service and the payment create flow.

#### Scenario: Concurrent updates do not corrupt remainingBalance

- GIVEN an account with `remainingBalance = 400` and one payment of `100`
- WHEN two `PATCH /payment/:id` requests run concurrently, one increasing the amount and the other decreasing it
- THEN exactly one transaction proceeds at a time
- AND the final `remainingBalance` reflects both operations in serial order

### Requirement: Payment Deletion — Soft Delete with Balance Restoration

The system MUST soft-delete a payment and restore its amount to the parent account's `remainingBalance`. The system MUST apply the account status transitions defined in the account spec (e.g., `FINISHED → ACTIVE` when the restored balance is positive).

#### Scenario: Delete restores balance and reactivates finished account

- GIVEN an account with `remainingBalance = 0`, `status = FINISHED`, and one payment of `100`
- WHEN `DELETE /payment/:id` is called by `ADMIN`
- THEN the account's `remainingBalance = 100`
- AND the account's `status = ACTIVE`
- AND the payment is soft-deleted

#### Scenario: Delete leaves overdue account overdue

- GIVEN an account with `remainingBalance = 100`, `status = OVERDUE`, and one payment of `50`
- WHEN `DELETE /payment/:id` is called by `ADMIN`
- THEN the account's `remainingBalance = 150`
- AND the account's `status = OVERDUE` (no transition to `ACTIVE`)

#### Scenario: Reject non-admin delete

- GIVEN a non-admin actor
- WHEN `DELETE /payment/:id` is called
- THEN the response is `403 Forbidden`

#### Scenario: Reject when payment does not exist

- GIVEN no payment with the supplied id
- WHEN `DELETE /payment/:id` is called
- THEN the response is `404 Not Found`

### Requirement: Payment Access Control — Zone-Scope

The system MUST restrict all payment operations to `ADMIN` (full access) or to actors whose assigned zones include the customer zone of the payment's parent account.

#### Scenario: Admin bypass

- GIVEN any payment
- WHEN any payment operation is invoked by `ADMIN`
- THEN the operation is permitted regardless of zone

#### Scenario: Prestamista must own the zone

- GIVEN a payment whose account customer zone is outside the actor's zones
- WHEN any payment operation is invoked by that actor
- THEN the response is `403 Forbidden`