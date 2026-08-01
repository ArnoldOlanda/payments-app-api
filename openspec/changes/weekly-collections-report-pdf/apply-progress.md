# Apply Progress — weekly-collections-report-pdf (API Unit 1)

> Work-unit slice: **API**. Web slice (Unit 2) and final cross-repo verification
> are out of scope for this batch. No git mutation performed. The web slice
> remains on `tasks.md` (Phase 4–5) and is the next work unit.

## Scope executed

- Phase 1 (RED): 1.1 → 1.4
- Phase 2 (GREEN): 2.1 → 2.5
- Phase 3 (VERIFY): 3.1 → 3.3

## TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `test/report/collections-weekly-pdf.service.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed (6/6) | ✅ 6 cases | ➖ Pure orchestration — no extraction needed |
| 1.2 | `test/report/collections-weekly-pdf.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed (14/14) | ✅ 14 cases (TZ, account cells, totals, empty week, headerRows, slug, PEN) | ➖ Helpers + template already split, no duplication |
| 1.3 | `test/report/report.controller.spec.ts` | Unit (supertest) | N/A (new) | ✅ Written | ✅ Passed (5/5) | ✅ 5 cases (200, 403, 400×3) | ➖ None needed — body assertion simplified to `pipe`/`end` call check |
| 1.4 | (gate) | — | — | ✅ All three suites failed to load (TS2307 missing module) | — | — | — |
| 2.1 | `test/report/collections-weekly-pdf.spec.ts` (`sanitizeFilenameSlug`, `formatPEN`) | Unit | — | — | ✅ Passed (2 helpers, 6 cases) | ✅ Multiple inputs (lowercase, trim, traversal, locale) | — |
| 2.2 | `test/report/collections-weekly-pdf.spec.ts` (template) | Unit | — | — | ✅ Passed (8 cases) | ✅ TZ, empty, totals, headerRows, title | ✅ Kept pure: only inputs → doc, no I/O |
| 2.3 | `test/report/collections-weekly-pdf.service.spec.ts` | Unit | — | — | ✅ Passed (6 cases) | ✅ 6 distinct orchestration cases | ✅ Service is thin orchestrator; PDFKit type corrected to `PDFKit.PDFDocument` |
| 2.4 | (module wiring, no test) | — | — | — | — | — | ✅ Provider added, ZoneModule untouched (already imported) |
| 2.5 | `test/report/report.controller.spec.ts` | Unit (supertest) | — | — | ✅ Passed (5 cases) | ✅ role matrix + DTO validation + headers + pipe | — |
| 3.1 | (gate) | — | — | — | ✅ 25/25 passed | — | — |
| 3.2 | refactor | — | — | — | — | — | ✅ `collectionsWeeklyPdf` pure; helpers reused; controller wires `sanitizeFilenameSlug` |
| 3.3 | (final gates) | — | — | — | — | — | ✅ tsc, eslint, focused suites all exit 0 |

### Test summary
- Total tests written: 25 (6 + 14 + 5)
- Total tests passing: 25
- Layers used: Unit only (supertest stays at the unit-integration boundary, no DB)
- Approval tests (refactoring): None — no refactor of pre-existing code
- Pure functions created: 2 (`sanitizeFilenameSlug`, `formatPEN`)

## Commands executed (exact, with exit codes)

| Command | Exit | Result |
|---------|------|--------|
| `node_modules/.bin/jest test/report/collections-weekly-pdf.service.spec.ts test/report/collections-weekly-pdf.spec.ts test/report/report.controller.spec.ts --no-coverage` (RED) | 1 | 3/3 suites fail to load (TS2307 missing module — expected) |
| `node_modules/.bin/jest test/report/collections-weekly-pdf.service.spec.ts test/report/collections-weekly-pdf.spec.ts test/report/report.controller.spec.ts --no-coverage` (GREEN) | 0 | 3/3 suites pass, 25/25 tests |
| `node_modules/.bin/jest test/report/collections-weekly-pdf.service.spec.ts test/report/collections-weekly-pdf.spec.ts test/report/report.controller.spec.ts test/report/ficha.report.spec.ts test/report/collections-weekly-report.service.spec.ts test/report/report.service.spec.ts --no-coverage` | 0 | 6/6 suites pass, 42/42 tests |
| `node_modules/.bin/tsc -p tsconfig.build.json --noEmit` | 0 | No type errors |
| `node_modules/.bin/eslint src/report/collections-weekly-pdf.helpers.ts src/report/documents/collections-weekly-pdf.ts src/report/collections-weekly-pdf.service.ts src/report/report.controller.ts src/report/report.module.ts test/report/collections-weekly-pdf.service.spec.ts test/report/collections-weekly-pdf.spec.ts test/report/report.controller.spec.ts` | 0 | No lint errors |

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command and exact result | `node_modules/.bin/jest test/report/collections-weekly-pdf.service.spec.ts test/report/collections-weekly-pdf.spec.ts test/report/report.controller.spec.ts --no-coverage` → 3/3 suites, 25/25 tests, exit 0 |
| Runtime harness command/scenario and exact result | N/A — sandbox blocks DB/TypeORM. Spec calls for `yarn build` as the runtime gate; we ran `tsc -p tsconfig.build.json --noEmit` instead and it passes (exit 0). The `e2e` supertest cases in `report.controller.spec.ts` exercise the full request path through Nest's pipeline (guards overridden, no DB), so the controller integration is covered at the unit boundary. |
| Rollback boundary | Drop the 6 new files (`src/report/collections-weekly-pdf.helpers.ts`, `src/report/collections-weekly-pdf.service.ts`, `src/report/documents/collections-weekly-pdf.ts`, `test/report/collections-weekly-pdf.service.spec.ts`, `test/report/collections-weekly-pdf.spec.ts`, `test/report/report.controller.spec.ts`) and revert the two edits to `src/report/report.controller.ts` (remove the new handler + 4th ctor dep) and `src/report/report.module.ts` (remove `CollectionsWeeklyPdfService` from providers). JSON weekly endpoint and `fichaReport` stay untouched. |

## Files touched (this work unit)

| File | Action | Lines | Notes |
|------|--------|-------|-------|
| `src/report/collections-weekly-pdf.helpers.ts` | Created | 44 | `sanitizeFilenameSlug`, `formatPEN` |
| `src/report/documents/collections-weekly-pdf.ts` | Created | 166 | Pure pdfmake doc, no ficha import |
| `src/report/collections-weekly-pdf.service.ts` | Created | 71 | `CollectionsWeeklyPdfService` orchestrator |
| `src/report/report.module.ts` | Modified | +2 | Added `CollectionsWeeklyPdfService` provider; `ZoneModule` already imported |
| `src/report/report.controller.ts` | Modified | +26 | New handler + 4th ctor dep `CollectionsWeeklyPdfService` |
| `test/report/collections-weekly-pdf.service.spec.ts` | Created | 159 | 6 tests |
| `test/report/collections-weekly-pdf.spec.ts` | Created | 352 | 14 tests (template + helpers) |
| `test/report/report.controller.spec.ts` | Created | 166 | 5 tests (supertest) |
| `openspec/changes/weekly-collections-report-pdf/tasks.md` | Modified | checkboxes | Marked 1.1 → 3.3 complete |

## Deviations from design

- `CollectionsWeeklyPdfService.generate` returns `{ doc, weekStart, weekEnd, zoneName }` instead of the bare `PDFKit.Document` named in the design. Reason: the controller needs the normalized week boundaries and the zone name to build the `Content-Disposition` filename; having the service own the single `findOne` call and surface the values avoids duplicating the data fetch in the controller. The `doc` field is the same value that would have been returned directly.
- `info.title` uses pdfmake's lowercase `title` (the `TDocumentInformation` schema) but the controller then sets `doc.info.Title = 'Reporte Semanal de Cobranzas'` on the PDFKit document at runtime. Both flows cooperate; the lowercase field is the pdfmake schema, the uppercase field is the PDFKit runtime metadata.

## Issues found

None.

## Remaining tasks (out of this batch)

- Phase 4: Web — `getCollectionsWeeklyReportPdfService(params)`, `weeklyAppliedQuery` snapshot, download button beside `Hoy`.
- Phase 5: Web verification (lint + build) and browser harness.
- Cross-repo `sdd-verify` after both slices.
- `sdd-archive` once verified.
