# Proposal: Close credits with confirmed overpayments

## Problem
Payment creation currently rejects amounts above an account's remaining balance. The product needs collectors to close a credit by recording a payment larger than the remaining balance, where the excess represents mora. The user must explicitly confirm this action in both mobile and web before the request is sent.

## Outcome
A confirmed overpayment records the full collected amount, applies only the remaining balance to the account, leaves the account with `remainingBalance = 0`, and transitions it to `finished`. The excess is preserved as the difference between the payment amount and its applied amount.

## Scope
- Add `appliedAmount` to payments, with a migration that backfills existing rows from `amount`.
- Require an explicit `closeWithOverpayment` intent for create/update requests that exceed the available balance.
- Update payment create, update, and delete logic to use `appliedAmount` for account balance changes.
- Add confirmation flows to the mobile payment registration screen and web add-payment modal.
- Update API, mobile, and web contracts and tests.

## Non-goals
- A separate mora entity or separate mora payment.
- Automatic closure without explicit UI confirmation and API intent.
- Changes to account status values or existing access-control rules.

## Decisions
- The full payment amount remains in `Payment.amount`.
- Only `Payment.appliedAmount` changes the account balance and is restored on deletion.
- Existing payments are treated as fully applied during migration.
- A payment against an already finished account remains rejected.

## Risks
- Payment update semantics need to restore the previous applied amount before calculating the new applied amount.
- Both UI clients must avoid sending the create request before confirmation.
- The API transaction and pessimistic account lock must remain intact.
