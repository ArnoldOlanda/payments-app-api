# Web operational account visibility

## Requirements

### Requirement: Main account view excludes finished accounts

The web main account view MUST request only `active`, `overdue`, and `cancelled` accounts from the paginated account API.

#### Scenario: Hide a finished account from Cuentas

- GIVEN an account has status `finished`
- WHEN the main Cuentas view loads or refreshes
- THEN the account is not returned for that view
- AND pagination metadata excludes it

#### Scenario: Keep a cancelled account visible

- GIVEN an account has status `cancelled`
- WHEN the main Cuentas view loads
- THEN the account can appear subject to existing authorization and zone filters

#### Scenario: Preserve filters and pagination

- GIVEN the user changes zone, page, or rows per page
- WHEN the account request is made
- THEN the request continues to include `active`, `overdue`, and `cancelled`
- AND finished accounts remain excluded

### Requirement: Finished account history remains available

The customer finished-credit history MUST continue to display `finished` accounts and allow their payment history to be opened.

#### Scenario: Access a finished account from customer history

- GIVEN a customer has a finished account
- WHEN the user opens that customer's finished-credit history
- THEN the finished account is displayed
- AND its payment details remain accessible

### Requirement: Archival does not add lifecycle state

The system MUST represent archival through view selection. It MUST NOT add an `archived` account status or convert `finished` accounts into another status.
