# Payment closure with overpayment

## Requirements

### Requirement: Confirmed overpayment closes an account
The payment API MUST accept a payment greater than the account's current `remainingBalance` only when `closeWithOverpayment` is `true`. The API MUST persist the full requested amount as `Payment.amount`, persist the amount applied to the account as `Payment.appliedAmount`, clamp the account balance to zero, and set the account status to `finished`.

#### Scenario: Reject overpayment without explicit intent
- GIVEN an accessible non-finished account with `remainingBalance = 100`
- WHEN a payment of `125` is created without `closeWithOverpayment = true`
- THEN the API returns `400 Bad Request`
- AND no payment is persisted
- AND the account is unchanged

#### Scenario: Confirmed overpayment closes the account
- GIVEN an accessible active account with `remainingBalance = 100`
- WHEN a payment of `125` is created with `closeWithOverpayment = true`
- THEN the API returns `201 Created`
- AND the persisted payment has `amount = 125`
- AND the persisted payment has `appliedAmount = 100`
- AND the account has `remainingBalance = 0`
- AND the account has status `finished`

#### Scenario: Exact payment does not require overpayment intent
- GIVEN an accessible account with `remainingBalance = 100`
- WHEN a payment of `100` is created without overpayment intent
- THEN the API returns `201 Created`
- AND `amount = 100`
- AND `appliedAmount = 100`
- AND the account is `finished`

#### Scenario: Partial payment remains unchanged
- GIVEN an accessible active account with `remainingBalance = 100`
- WHEN a payment of `40` is created without overpayment intent
- THEN the API returns `201 Created`
- AND `amount = 40`
- AND `appliedAmount = 40`
- AND the account has `remainingBalance = 60`
- AND the account remains `active`

#### Scenario: Finished accounts reject all payments
- GIVEN an account with status `finished`
- WHEN any positive payment is created
- THEN the API returns `400 Bad Request`
- AND no payment is persisted

### Requirement: Payment balance mutations use applied amount
The payment service MUST use `appliedAmount`, not `amount`, when restoring or recalculating an account balance.

#### Scenario: Delete an overpayment restores only applied balance
- GIVEN a finished account with `remainingBalance = 0`
- AND a payment with `amount = 125` and `appliedAmount = 100`
- WHEN the payment is deleted
- THEN the account has `remainingBalance = 100`
- AND the account is reactivated according to existing status rules
- AND the payment is soft-deleted
- AND the excess `25` is not restored to the account balance

#### Scenario: Edit an overpayment recalculates applied amount
- GIVEN a finished account with `remainingBalance = 0`
- AND a payment with `amount = 125` and `appliedAmount = 100`
- WHEN the payment is edited to `amount = 50`
- THEN the previous applied amount is released before recalculation
- AND the payment has `amount = 50` and `appliedAmount = 50`
- AND the account has `remainingBalance = 50`
- AND the account is reactivated according to existing status rules

#### Scenario: Editing into an overpayment requires intent
- GIVEN a payment update has available balance `100`
- WHEN its amount is changed to `125` without `closeWithOverpayment = true`
- THEN the API returns `400 Bad Request`
- AND neither the payment nor account is modified

### Requirement: Mobile confirmation precedes overpayment request
The mobile payment registration UI MUST compare the entered amount with the current account remaining balance. It MUST send a normal request for amounts at or below the balance and MUST display a confirmation before sending a request for an overpayment.

#### Scenario: Mobile cancels overpayment confirmation
- GIVEN the entered amount exceeds the displayed remaining balance
- WHEN the user selects Cancel in the confirmation dialog
- THEN no payment request is sent
- AND the entered form values remain available for correction

#### Scenario: Mobile confirms overpayment
- GIVEN the entered amount exceeds the displayed remaining balance
- WHEN the user confirms the closure
- THEN exactly one payment request is sent with `closeWithOverpayment = true`
- AND the UI refreshes active credits after success

### Requirement: Web confirmation precedes overpayment request
The web add-payment modal MUST apply the same confirmation contract as mobile.

#### Scenario: Web cancels overpayment confirmation
- GIVEN the entered amount exceeds the selected account remaining balance
- WHEN the user cancels the confirmation
- THEN no payment request is sent
- AND the modal remains available for correction

#### Scenario: Web confirms overpayment
- GIVEN the entered amount exceeds the selected account remaining balance
- WHEN the user confirms the closure
- THEN exactly one payment request is sent with `closeWithOverpayment = true`
- AND the account list is refreshed after success

### Requirement: Existing payments remain compatible
A migration MUST add `appliedAmount` and initialize it from `amount` for all existing non-deleted and deleted payment rows. The migration MUST be reversible according to repository migration conventions.

### Requirement: Transactional integrity remains intact
Payment create, update, and delete operations MUST retain their existing database transactions, access checks, and pessimistic write locks on the affected account/payment rows.
