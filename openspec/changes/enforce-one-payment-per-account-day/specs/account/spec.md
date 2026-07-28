# Account collection eligibility

## Requirements

### Requirement: Account listings can select credits collectible today

`GET /account` MUST accept an optional boolean `collectibleToday` query parameter. When `true`, the API MUST exclude accounts that have a non-deleted payment during the current `America/Lima` calendar day.

#### Scenario: Exclude an account paid today

- GIVEN an account matches all requested status and zone filters
- AND it has a non-deleted payment during the current Lima day
- WHEN accounts are requested with `collectibleToday=true`
- THEN the account is not returned
- AND pagination metadata does not count that account

#### Scenario: Keep an account whose last payment was before today

- GIVEN an account matches all requested status and zone filters
- AND its latest non-deleted payment occurred before the current Lima day
- WHEN accounts are requested with `collectibleToday=true`
- THEN the account remains eligible for the result

#### Scenario: Ignore a deleted payment from today

- GIVEN an account matches all requested status and zone filters
- AND its only payment during the current Lima day is soft-deleted
- WHEN accounts are requested with `collectibleToday=true`
- THEN the account remains eligible for the result

#### Scenario: Preserve existing account query behavior by default

- GIVEN an account has a payment today
- WHEN accounts are requested without `collectibleToday=true`
- THEN payment-day eligibility does not alter the result
- AND existing status, zone, authorization, ordering, and pagination behavior remains unchanged

### Requirement: Eligibility is filtered before pagination

The API MUST apply `collectibleToday` in the database query before count, skip, and limit operations.

#### Scenario: Return full eligible pages

- GIVEN ineligible paid-today accounts are interleaved with eligible accounts
- WHEN a paginated query uses `collectibleToday=true`
- THEN the returned page contains up to the requested number of eligible accounts
- AND `meta.total` and `meta.totalPages` describe only eligible accounts
