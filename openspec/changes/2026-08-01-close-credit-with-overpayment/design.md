# Design: Close credits with confirmed overpayments

## Architecture

The feature remains within the existing payment bounded context. No new endpoint or mora entity is introduced.

Data flow:

1. Mobile or web compares the entered amount with the current account balance.
2. For an overpayment, the UI obtains explicit user confirmation.
3. The client sends the existing payment request with `closeWithOverpayment: true`.
4. `PaymentService` locks the account, validates the intent, computes `appliedAmount`, persists the payment and account in one transaction.
5. Account lists and payment summaries are refreshed after success.

The backend remains authoritative: UI confirmation alone is not sufficient.

## Persistence

Add to `Payment`:

```ts
@Column({ type: 'float' })
appliedAmount: number;
```

The value is the portion of the payment that affects `Account.remainingBalance`.

For a normal payment:

```text
amount = appliedAmount
```

For a confirmed overpayment:

```text
amount > appliedAmount
```

The implicit mora is `amount - appliedAmount`; it is not stored as a separate entity.

Migration strategy:

1. Add `appliedAmount` as nullable or with a temporary default compatible with existing rows.
2. Backfill every row with `appliedAmount = amount`.
3. Enforce non-null after backfill.
4. Remove any temporary default if repository conventions require application-side assignment.
5. Down migration drops the column.

## DTO and validation design

`CreatePaymentDto` and `UpdatePaymentDto` receive:

```ts
@IsOptional()
@IsBoolean()
closeWithOverpayment?: boolean;
```

The API only checks the flag when the requested amount exceeds the available balance. It does not require the flag for partial or exact payments.

The payment service rejects invalid non-positive values according to the existing validation contract and continues to reject finished accounts.

## Create algorithm

Inside the existing transaction and account row lock:

```text
availableBalance = account.remainingBalance
if amount > availableBalance and closeWithOverpayment !== true:
    reject
appliedAmount = min(amount, availableBalance)
payment.amount = amount
payment.appliedAmount = appliedAmount
account.remainingBalance = availableBalance - appliedAmount
if account.remainingBalance == 0:
    account.status = FINISHED
persist payment and account
```

The full requested amount is never truncated in the payment record.

## Update algorithm

Inside the existing payment and account locks:

1. Load the previous `appliedAmount`. For compatibility with any in-memory or pre-migration value, treat it as the previous amount only where the migration guarantees the field exists.
2. Calculate the balance available before this payment:

```text
availableBalance = account.remainingBalance + previousAppliedAmount
```

3. If the new amount exceeds `availableBalance`, require `closeWithOverpayment = true`.
4. Calculate:

```text
newAppliedAmount = min(newAmount, availableBalance)
newRemainingBalance = availableBalance - newAppliedAmount
```

5. Update both `payment.amount` and `payment.appliedAmount`.
6. Recompute account status using current rules:
   - zero balance becomes `FINISHED`;
   - a previously finished account with positive balance becomes `ACTIVE`;
   - an overdue account remains overdue when it remains positive.

This prevents a mora amount from being restored as account balance during later edits.

## Delete algorithm

Inside the existing transaction and locks:

```text
account.remainingBalance += payment.appliedAmount
```

Then apply the existing status transition rules and soft-delete the payment. The full `payment.amount` is never restored.

## Mobile design

Primary screen:

`mobile/app/(tabs)/(homeStack)/[paymentRegister].tsx`

Supporting changes:

- Extend the payment request type in `mobile/Credit/services/postPaymentService.ts`.
- Ensure the screen has a reliable current `remainingBalance` from the selected/current credit.
- Maintain pending form values and a pending overpayment flag in component state.
- Reuse `mobile/components/dialogs/ConfirmDialog.tsx`.

Submit behavior:

```text
validate form
if amount <= remainingBalance:
    post once without closeWithOverpayment
else:
    store pending values
    show confirmation
on confirm:
    post once with closeWithOverpayment=true
on cancel:
    close dialog and keep form values
```

The submit control remains disabled while the request is in flight.

## Web design

Primary component:

`web/src/sections/account/AddPaymentModal.tsx`

Supporting changes:

- Extend `web/src/interfaces/payment.ts`.
- Extend `web/src/services/payment.service.ts` request typing.
- Reuse the existing web modal/dialog primitive if available; otherwise use the project-standard MUI dialog.

The selected account is the source of `remainingBalance`. The initial submit handler must stop before calling the API when confirmation is required. The confirmation action resumes the original submit with `closeWithOverpayment: true`.

## Testing design

Backend unit tests will mock the transactional manager and assert:

- flag validation;
- persisted `amount` versus `appliedAmount`;
- account balance/status transitions;
- deletion and update restoration behavior;
- no saves on rejected requests;
- transaction and pessimistic-lock usage.

UI tests will mock payment services and assert request timing, confirmation behavior, cancellation, duplicate-submit prevention, and successful refresh behavior.

## Risks and mitigations

- Stale UI balance: backend re-reads and locks the account; stale overpayment intent is still validated against the locked balance.
- Floating-point currency behavior: preserve existing numeric conventions in this change and avoid introducing a new rounding model.
- Existing payment rows: migration backfill ensures every row has an applied amount.
- Cross-repository changes: API contract, mobile client, and web client must be updated together before commits.
