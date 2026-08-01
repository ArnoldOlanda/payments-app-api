# Archive Report: Weekly Collections Report PDF

## Outcome

The `weekly-collections-report-pdf` change was verified, synchronized into the collections-report source of truth, and archived on 2026-08-01.

## Synced Requirements

| Domain | Action | Count |
|--------|--------|-------|
| `collections-report` | Added | 6 |
| `collections-report` | Modified | 0 |
| `collections-report` | Removed | 0 |

Added requirements:

1. Weekly Collections PDF Endpoint
2. PDF Matches the Loaded Weekly Report
3. Empty Weeks Produce Valid PDFs
4. Safe Direct Download Filename
5. Weekly Web Download Control
6. Legacy Behavior Remains Unchanged

All four pre-existing requirements were preserved verbatim:

- Collections Report Endpoint
- Collections Report Response Shape
- Collections Report Totals by Zone
- Collections Report Date Boundaries

## Archive Contents

- [x] `proposal.md`
- [x] `specs/collections-report/spec.md`
- [x] `design.md`
- [x] `tasks.md` — 19/19 tasks complete
- [x] `apply-progress.md`
- [x] `verify-report.md` — PASS, 0 critical findings, 0 warnings, 1 suggestion

## Source of Truth Updated

- `openspec/specs/collections-report/spec.md`

## Native Review Lifecycle

The native bounded-review lifecycle was not run, and no review transaction, ledger, receipt, or gate-context artifacts exist for this change. The user explicitly authorized proceeding without the review-receipt gate because the size exception and direct main-line delivery were authorized and independent verification reported PASS.

## Delivery Discrepancy

Actual delivery was 1,443 changed lines versus the approved 460-line cap. This exceeded the approved estimate by 983 lines. The discrepancy is retained in the audit trail; functionality and specification compliance were independently verified with a PASS verdict.

## SDD Cycle Complete

The change has been planned, implemented, independently verified, synchronized, and archived. The active change folder was removed from `openspec/changes/` and is retained at `openspec/changes/archive/2026-08-01-weekly-collections-report-pdf/`.
