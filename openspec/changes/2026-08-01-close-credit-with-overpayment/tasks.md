# Tasks: Close credits with confirmed overpayments

## API persistence and contract

- [x] Add `appliedAmount` to `api/src/payment/entities/payment.entity.ts`.
- [x] Add `closeWithOverpayment` to `api/src/payment/dto/create-payment.dto.ts` with boolean validation.
- [x] Add `closeWithOverpayment` to `api/src/payment/dto/update-payment.dto.ts` with boolean validation.
- [x] Add a TypeORM migration under `api/src/migrations` to add and backfill `payment.appliedAmount` from `payment.amount`, then enforce the final non-null contract.
- [x] Update any payment interfaces or serializers that expose payment fields.

## API payment behavior

- [x] Update `PaymentService.create` to require explicit overpayment intent, calculate `appliedAmount`, clamp the account balance to zero, and preserve the full payment amount.
- [x] Keep finished-account rejection, access checks, transaction boundaries, and pessimistic account lock behavior unchanged.
- [x] Update `PaymentService.update` to restore the previous applied amount before recalculating the new applied amount and require intent for edited overpayments.
- [x] Update `PaymentService.remove` to restore only `payment.appliedAmount` and preserve existing status transition rules.
- [x] Update API payment unit tests for partial, exact, rejected overpayment, confirmed overpayment, edit, delete, finished account, and transactional behavior.
- [x] Update `api/openspec/specs/payment/spec.md` only if the project-level contract must reflect the new finalized behavior after implementation.

## Mobile client

- [x] Extend the mobile payment request type and service to send `closeWithOverpayment`.
- [x] Ensure the payment registration screen has the current account `remainingBalance`.
- [x] Add pending-submit state and detect amounts greater than the remaining balance.
- [x] Reuse `ConfirmDialog` to show remaining amount, entered amount, and mora excess before any overpayment request.
- [x] Send exactly one confirmed request with `closeWithOverpayment = true`.
- [x] Preserve form values on cancellation and prevent duplicate submits while loading.
- [x] Add or update mobile tests for normal payment, overpayment confirmation, cancellation, confirmation, and API failure.

## Web client

- [x] Extend web payment request types and service payloads with `closeWithOverpayment`.
- [x] Use the selected account remaining balance in `AddPaymentModal`.
- [x] Add a confirmation dialog before sending an overpayment request.
- [x] Preserve form state on cancellation and send the flag only after confirmation.
- [x] Refresh accounts and handle loading/errors after successful or failed requests.
- [x] Add or update web tests for normal payment, overpayment confirmation, cancellation, confirmation, and API failure.

## Verification and delivery

- [ ] Run API lint and unit tests in strict TDD order: RED, GREEN, TRIANGULATE, REFACTOR.
- [ ] Run API e2e tests and migration checks.
- [ ] Run mobile typecheck/lint/tests available in the repository.
- [ ] Run web typecheck/lint/tests available in the repository.
- [ ] Review the combined diff across the three repositories and confirm the change remains within the 500-line review budget or stop for approval if it exceeds it.
- [ ] Commit API, mobile, and web changes on their respective `main` branches using focused commit messages; do not push or open a PR unless separately requested.
