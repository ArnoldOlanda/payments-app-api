# Delta for Collections Report

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
