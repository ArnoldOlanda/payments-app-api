# Delta for Collections Report

Este delta introduce el bounded context `collections-report`. Cuando se
archive el change, el archivo se promovera como spec canonica en
`openspec/specs/collections-report/spec.md`.

## ADDED Requirements

### Requirement: Collections Report Endpoint

The system MUST expose a paginated endpoint that returns every payment
registered in a date or date range, optionally filtered by the user who
registered the payment and by the customer's zone. The endpoint is
restricted to `ADMIN` actors.

#### Scenario: Default range is today in the actor timezone

- GIVEN an `ADMIN` actor with timezone `America/Argentina/Buenos_Aires`
- AND the current instant in `America/Argentina/Buenos_Aires` is
  `2026-07-25T10:00:00-03:00`
- WHEN `GET /report/collections` is called with no query params
- THEN the query uses `from = 2026-07-25T00:00:00-03:00` and
  `to = 2026-07-25T23:59:59.999-03:00`
- AND the response is `200 OK` with `{ data: [...], meta: {...} }`

#### Scenario: Filter by date range

- GIVEN an `ADMIN` actor
- WHEN `GET /report/collections?from=2026-07-01&to=2026-07-31` is called
- THEN the response contains only payments with `payment.date` inside
  the actor's timezone calendar window `2026-07-01..2026-07-31`
- AND the response is `200 OK`

#### Scenario: Filter by registering user

- GIVEN a user `u-1`
- WHEN `GET /report/collections?userId=u-1` is called
- THEN every returned row has `payment.userId === u-1`

#### Scenario: Filter by zone

- GIVEN a zone `z-1`
- WHEN `GET /report/collections?zoneId=z-1` is called
- THEN every returned row has `customer.zoneId === z-1`

#### Scenario: Combined filters

- GIVEN filters `from=2026-07-01`, `to=2026-07-31`, `userId=u-1`,
  `zoneId=z-1`
- WHEN `GET /report/collections?from=...&to=...&userId=u-1&zoneId=z-1`
  is called
- THEN every returned row satisfies ALL filters (logical AND)

#### Scenario: Pagination

- GIVEN there are 250 payments in the queried window
- WHEN `GET /report/collections?page=2&limit=100` is called
- THEN the response includes rows 101..200 and
  `meta = { total: 250, page: 2, limit: 100, totalPages: 3 }`

#### Scenario: Reject inverted range

- GIVEN `from > to`
- WHEN `GET /report/collections?from=2026-07-31&to=2026-07-01` is called
- THEN the response is `400 Bad Request`

#### Scenario: Cap limit at 200

- GIVEN a request with `limit=500`
- WHEN the endpoint is called
- THEN the effective `limit` used in the query is `200`

#### Scenario: Reject non-ADMIN actors

- GIVEN a `PRESTAMISTA` actor
- WHEN `GET /report/collections` is called
- THEN the response is `403 Forbidden`

#### Scenario: Exclude soft-deleted payments

- GIVEN a payment `p-1` with `deletedAt` not null
- WHEN `GET /report/collections` is called in `p-1`'s date window
- THEN `p-1` is NOT included in the response

### Requirement: Collections Report Response Shape

The system MUST return each row with the fields required by the UI:

`id`, `date` (ISO timestamp), `registeredAt` (ISO timestamp), `amount`,
`account: { id, amount, customer: { id, name, lastName, zone: { id, name } | null } }`,
`user: { id, name } | null`.

#### Scenario: Row includes required fields

- GIVEN a payment with `id=p-1`
- WHEN the response is returned
- THEN the row contains `id, date, registeredAt, amount, account.id,
  account.amount, account.customer.id, account.customer.name,
  account.customer.lastName, account.customer.zone, user`

#### Scenario: Payments with no registering user show null user

- GIVEN a payment `p-1` with `userId = null` (legacy data)
- WHEN the response is returned
- THEN the row has `user: null`

### Requirement: Collections Report Totals by Zone

The response MUST include a `totals.byZone` array computed from the same
date range and `userId` filter as the rows, but independent of the
`zoneId` filter so the operator always sees the full picture.

Each entry MUST be `{ zoneId, zoneName, totalCollected, paymentCount }`,
sorted by `totalCollected` DESC. Rows whose customer has no zone
collapse into a single entry with `zoneId: null` and
`zoneName: "Sin zona"`.

#### Scenario: byZone reflects the active date range and userId filter

- GIVEN the same filters that drive `data[]`
- WHEN the response is returned
- THEN `totals.byZone` reflects those filters

#### Scenario: byZone ignores the zoneId filter

- GIVEN `zoneId = z-1` is selected
- WHEN the response is returned
- THEN `totals.byZone` still contains every zone, not only `z-1`
- AND the operator can compare zones while drilling into one

#### Scenario: byZone excludes soft-deleted payments

- GIVEN soft-deleted payments in the period
- WHEN the response is returned
- THEN they do not contribute to `totalCollected` or `paymentCount`
  in any `byZone` entry

#### Scenario: byZone is empty when no payments match

- GIVEN no payments in the active window
- WHEN the response is returned
- THEN `totals.byZone = []`

### Requirement: Collections Report Date Boundaries

The system MUST interpret `from` and `to` as calendar days in the actor
timezone, NOT as UTC instants parsed by `new Date('YYYY-MM-DD')`.

#### Scenario: Same query, different timezones, different rows

- GIVEN a payment persisted with `payment.date = 2026-07-26T03:00:00Z`
- AND an `ADMIN` actor with timezone `America/Argentina/Buenos_Aires`
  (`UTC-3`) calling with `from=2026-07-25&to=2026-07-25`
- AND another `ADMIN` actor with timezone `Asia/Tokyo` (`UTC+9`) calling
  with `from=2026-07-26&to=2026-07-26`
- WHEN both requests run
- THEN the Buenos Aires actor receives the row
- AND the Tokyo actor receives the row
- AND a request with timezone `UTC` and `from=2026-07-26&to=2026-07-26`
  also receives the row

## MODIFIED Requirements

None. The bounded context `collections-report` is new; no existing
canonical spec is altered by this delta.