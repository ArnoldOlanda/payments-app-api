# Payment daily uniqueness

## Requirements

### Requirement: One live payment per account and Lima calendar day

The payment API MUST allow at most one non-deleted payment for an account on each calendar day interpreted in `America/Lima`. The rule MUST apply to every authorized role and client and MUST use the requested `payment.date`, including historical dates.

#### Scenario: Reject a duplicate payment on the same Lima day

- GIVEN an accessible non-finished account
- AND a non-deleted payment already exists for that account on a Lima calendar day
- WHEN another payment is created for the same account and Lima calendar day
- THEN the API returns `409 Conflict`
- AND no payment is persisted
- AND the account balance and status are unchanged

#### Scenario: Allow payments on adjacent Lima days

- GIVEN a non-deleted payment exists for an account on one Lima calendar day
- WHEN another valid payment is created for the same account on the following Lima calendar day
- THEN the payment is accepted
- AND existing balance and status rules are applied

#### Scenario: UTC instants are compared as Lima calendar dates

- GIVEN two payment instants that have different UTC dates but resolve to the same calendar date in `America/Lima`
- WHEN the second payment is created for the same account
- THEN the API returns `409 Conflict`

#### Scenario: Soft deletion releases the day

- GIVEN the only payment for an account/Lima day has been soft-deleted
- WHEN a valid replacement payment is created for that account and day
- THEN the replacement is accepted

### Requirement: Payment date updates preserve daily uniqueness

When a payment date is changed, the payment API MUST enforce the same account/Lima-day uniqueness rule while excluding the payment being edited from its duplicate lookup.

#### Scenario: Keep a payment on its current day

- GIVEN an existing payment is the only live payment for its account/Lima day
- WHEN it is updated without changing its effective Lima calendar day
- THEN the update is accepted

#### Scenario: Reject moving a payment into an occupied day

- GIVEN an account has live payments on two different Lima calendar days
- WHEN one payment is moved into the other payment's Lima calendar day
- THEN the API returns `409 Conflict`
- AND neither the payment nor account is modified

#### Scenario: Move a payment into a free day

- GIVEN an existing payment
- AND the target Lima calendar day has no other live payment for the account
- WHEN the payment date is changed to that day
- THEN the update is accepted

### Requirement: Duplicate enforcement remains transactional

Duplicate detection MUST execute inside the existing payment transaction after the affected account is pessimistically locked. Existing authorization, overpayment, applied amount, balance, and account-status behavior MUST remain intact.

#### Scenario: Concurrent writers are serialized by the account lock

- GIVEN two requests attempt to create a payment for the same account/Lima day
- WHEN both execute through the payment service
- THEN duplicate detection occurs while holding the account write lock
- AND at most one request can persist a live payment for that account/day
