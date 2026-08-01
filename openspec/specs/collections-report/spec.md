# Collections Report Specification

## Purpose

The `collections-report` bounded context exposes a paginated, filterable
report of payments collected in a given date or date range. The report
is restricted to `ADMIN` actors and powers the operator's screen at
`/report/collections`. It also returns per-zone aggregates so the
operator can compare zones while drilling into a single one.

## Requirements

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
- AND the response is `200 OK` with `{ data, totals, meta }`

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

## ADDED Requirements

### Requirement: Weekly Collections PDF Endpoint

The system MUST expose `GET /report/collections/weekly/pdf` as `ADMIN`-only, returning `application/pdf`. It MUST validate `weekStart`, `zoneId`, and optional/current `userId` with the weekly JSON report's semantics. Invalid filters MUST be rejected without report content.

#### Scenario: Download a filtered weekly report

- GIVEN an `ADMIN` actor and valid weekly filters
- WHEN the PDF endpoint is requested
- THEN it returns `200 OK` with `Content-Type: application/pdf`
- AND it represents the normalized requested week, zone, and user scope

#### Scenario: Reject invalid filters

- GIVEN an invalid `weekStart`, `zoneId`, or `userId`
- WHEN the PDF endpoint is requested
- THEN it returns `400 Bad Request` without a PDF or report data

#### Scenario: Reject non-ADMIN access

- GIVEN a non-`ADMIN` actor
- WHEN the PDF endpoint is requested
- THEN it returns `403 Forbidden` and MUST NOT disclose report content

### Requirement: PDF Matches the Loaded Weekly Report

The PDF MUST use the exact successfully loaded scope: normalized week, zone, and resolved user. It MUST NOT use unsent or stale edited controls. Each account row MUST show seven weekday boxes containing actual collected `Payment.amount` totals for that account/day, with no expected-installment comparison, plus row weekly totals, daily totals, and the overall total in portrait/vertical layout.

#### Scenario: Preserve exact filter consistency

- GIVEN a successfully loaded weekly report with normalized week, zone, and user
- WHEN the operator downloads it without a matching reload
- THEN every row and total uses that exact scope
- AND day values equal the canonical weekly payment aggregation

#### Scenario: Preserve the weekly structure

- GIVEN a weekly report with account data and payments
- WHEN its PDF is generated
- THEN it is portrait/vertical with account rows, seven weekday boxes, row totals, daily totals, and an overall total

### Requirement: Empty Weeks Produce Valid PDFs

A valid week with no matching payments MUST remain downloadable. Account rows MUST remain when supplied by the weekly report, no-payment boxes MUST be empty, and monetary totals MUST be zero.

#### Scenario: Download a week with no payments

- GIVEN valid filters for a week with no payments
- WHEN an `ADMIN` actor downloads the PDF
- THEN it is a valid `application/pdf` with account rows, empty payment cells, and zero monetary totals

### Requirement: Safe Direct Download Filename

The PDF download MUST use `reporte-cobranzas-<zone>-<start>-<end>.pdf`, with a sanitized zone and normalized week boundaries. The web flow MUST download directly and MUST NOT open a preview modal.

#### Scenario: Sanitize the filename

- GIVEN a valid report whose zone contains unsafe filename characters
- WHEN the PDF is downloaded
- THEN the filename has a sanitized zone, normalized dates, and `.pdf`
- AND it MUST NOT contain path traversal or unsafe separators

### Requirement: Weekly Web Download Control

The web report MUST show a download button beside `Hoy` only in weekly mode. It MUST be disabled until a matching report is loaded and while downloading. A failure MUST preserve the report, restore availability, and provide user-visible feedback; success MUST remain a direct download.

#### Scenario: Manage availability and recovery

- GIVEN the operator is viewing weekly mode
- WHEN no matching report is loaded, a download is running, or a download fails
- THEN the button is disabled, remains disabled, or is restored respectively
- AND failure leaves the report visible with user-visible feedback

### Requirement: Legacy Behavior Remains Unchanged

Weekly PDF export MUST NOT change ficha-pagos behavior or existing weekly and non-weekly JSON behavior.

#### Scenario: Preserve existing report behavior

- GIVEN existing ficha-pagos and JSON report requests
- WHEN weekly PDF export is available
- THEN responses, filters, authorization, and content semantics remain unchanged
