# Tasks: Weekly Collections Report PDF

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380–460 (API ~280, Web ~120) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | API slice → Web slice |
| Delivery strategy | exception-ok (maintainer-approved) |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

- **Unit 1 — API.** Endpoint, pure template, service delegation, ADMIN guard, sanitized filename. Test: `yarn test src/report/collections-weekly-pdf*.spec.ts src/report/report.controller.spec.ts` + `yarn lint && yarn build`. Runtime: `curl -u admin` → `/report/collections/weekly/pdf` writes `application/pdf` (N/A sandbox). Rollback: drop new files; revert controller+module; JSON untouched.
- **Unit 2 — Web.** Download button beside `Hoy`, blob service, applied-query snapshot, failure recovery. Test: `yarn lint && yarn build`. Runtime: browser — load weekly → click → `reporte-cobranzas-<zone>-<start>-<end>.pdf`; toggle filters keeps applied scope; empty week downloads; 500 → toast + restore; `revokeObjectURL`. Rollback: revert 3 web files; button gone; JSON fetch unchanged.

## Phase 1: API Foundation (RED)

- [x] 1.1 RED — `api/test/report/collections-weekly-pdf.service.spec.ts`: `generate(q,tz)` forwards to `CollectionsWeeklyReportService.findOne`, returns `PDFKit.Document`, surfaces zone 404.
- [x] 1.2 RED — `api/test/report/collections-weekly-pdf.spec.ts`: TZ weekday labels, missing date → `—`, empty week keeps rows + zero totals, slug strips unsafe chars + rejects `..`/`/`.
- [x] 1.3 RED — `api/test/report/report.controller.spec.ts` supertest: 200 with `Content-Type: application/pdf` + sanitized `Content-Disposition`; non-ADMIN → 403; bad `weekStart` → 400.
- [x] 1.4 Confirm three suites fail.

## Phase 2: API Implementation (GREEN)

- [x] 2.1 Create `collections-weekly-pdf.helpers.ts` with `sanitizeFilenameSlug` + `formatPEN`.
- [x] 2.2 Create `documents/collections-weekly-pdf.ts` with pure `collectionsWeeklyPdf(input): TDocumentDefinitions` (portrait 15-col, `headerRows: 1`, PEN cells, no ficha import).
- [x] 2.3 Create `collections-weekly-pdf.service.ts` injecting `CollectionsWeeklyReportService`, `ZoneService`, `PrinterService`; findOne → zone 404 → template → `createPdf`.
- [x] 2.4 Register provider in `report.module.ts` (`ZoneModule` already present).
- [x] 2.5 Wire in `report.controller.ts`: `@Get('collections/weekly/pdf')`, `@Auth(ADMIN)`, pipe service, headers per design.

## Phase 3: API Verification

- [x] 3.1 GREEN — all three suites pass.
- [x] 3.2 REFACTOR — keep `collectionsWeeklyPdf` pure; reuse helpers.
- [x] 3.3 `yarn lint && yarn build` in `api/` passes.

## Phase 4: Web Service + Store + View

- [x] 4.1 Add `getCollectionsWeeklyReportPdfService(params)` to `services/report.service.ts` with `responseType:'blob'` + fallback header.
- [x] 4.2 Add `weeklyAppliedQuery: CollectionsWeeklyQuery | null` to `store/useCollectionsReportStore.ts`; set from `response.weekStart` inside `fetchWeekly` success.
- [x] 4.3 Render download button beside `Hoy` in `sections/collections-report/CollectionsReportView.tsx`, weekly-only, disabled when `weeklyAppliedQuery` is null or downloading.
- [x] 4.4 Click handler: build query from snapshot, call service, create object URL, click anchor, `revokeObjectURL`; on error toast + restore.

## Phase 5: Web Verification + Cross-repo Progress

- [x] 5.1 `yarn lint && yarn build` in `web/` passes.
- [x] 5.2 Browser harness: (a) weekly load → click → `reporte-cobranzas-<zone>-<start>-<end>.pdf`; (b) filter toggle after load → applied scope; (c) empty week → zero totals; (d) force 500 → toast + restore; (e) `revokeObjectURL` confirmed.
- [x] 5.3 Append `apply-progress` to `api/openspec/changes/weekly-collections-report-pdf/apply-progress.md` after each slice; web references path; no git.
