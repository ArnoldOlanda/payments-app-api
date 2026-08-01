# Proposal: Weekly Collections Report PDF

## Intent

Operators on the admin weekly report at /report/collections (weekly mode) need a one-click PDF mirroring the screen: collected Payment.amount per account per day, same user/zone/week filters, same ADMIN-only access. Only JSON exists today; ficha-pagos is a blank cobrador sheet, not reusable.

## Scope

### In Scope
- GET /report/collections/weekly/pdf with @Auth(ADMIN), application/pdf.
- New pdfmake template mirroring ficha.report.ts style, populated with actual collected amounts.
- Reuse CollectionsWeeklyReportService.findOne() and CollectionsWeeklyQueryDto.
- Web: download button beside Hoy in weekly header; blob-download service.
- Filename: reporte-cobranzas-<zone>-<start>-<end>.pdf (sanitized).
- Empty week still downloads (zero totals).

### Out of Scope
- Changing fichaReport(), getFichaPagos(), or existing JSON behavior.
- Landscape, preview modal, email exports, expected-installment comparison.
- Branches, commits, PRs.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- collections-report: ADDED Requirements only. (1) PDF endpoint with ADMIN guard. (2) Day cells = sum of payment.amount per account/day. (3) Empty week still downloads. (4) Sanitized filename. No MODIFIED/REMOVED. Delta at openspec/changes/weekly-collections-report-pdf/specs/collections-report/spec.md.

## Approach

A new service calls CollectionsWeeklyReportService.findOne() and pipes the WeeklyReportResponse into a pdfmake document definition reusing PrinterService.createPdf(). The template borrows ficha.report.ts header/footer composition (no import) and adds per-day amount cells plus a totals row.

## Affected Areas

- api/src/report (modified): + GET /report/collections/weekly/pdf handler + new collections-weekly-pdf.service.ts and documents/collections-weekly-pdf.ts template + module registration.
- api/test/report (new): collections-weekly-pdf.service.spec.ts and collections-weekly-pdf.spec.ts.
- web/src/services/report.service.ts (modified): + getCollectionsWeeklyReportPdfService() Blob.
- web/src/sections/collections-report/CollectionsReportView.tsx (modified): button beside Hoy, disabled until weekly loaded.
- api/openspec/changes/weekly-collections-report-pdf/specs/collections-report/spec.md (new): ADDED Requirements delta only.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ~420 LOC exceeds 400-line review budget | Medium | Ask-before-splitting in tasks; user forbids branches. |
| Portrait cramps 7 day columns | Medium | Landscape is a one-line follow-up; not blocker. |
| Authorization drift / filename injection | Low | Test pins @Auth(ValidRole.ADMIN); sanitize slug. |
| Web blob responseType misconfig | Low | Mirror existing axios; lint + runtime. |

## Rollback Plan

Revert the new service, template, controller route, web service, and web button in one working-tree change. JSON endpoint stays untouched; existing weekly usage unaffected. Button removal hides the entry point instantly.

## Dependencies

- PrinterService.createPdf(), CollectionsWeeklyReportService.findOne(), CollectionsWeeklyQueryDto, existing web axios instance — all already in place.

## Success Criteria

- [ ] GET /report/collections/weekly/pdf returns application/pdf with ADMIN guard.
- [ ] Day cells equal sum of payment.amount per account/day (matches JSON).
- [ ] Zero-payment week still downloads with totals.totalCollected = 0.
- [ ] Non-ADMIN actors receive 403 Forbidden.
- [ ] Button beside Hoy appears only in weekly mode, disabled until weekly loaded.
- [ ] Filename is reporte-cobranzas-<zone>-<start>-<end>.pdf (sanitized).
- [ ] Legacy ficha-pagos and JSON endpoint pass unchanged.
