# Design: Weekly Collections Report PDF

## Technical Approach

Add `GET /report/collections/weekly/pdf` as `ADMIN`-only via a new `CollectionsWeeklyPdfService` that calls `CollectionsWeeklyReportService.findOne()` and pipes the typed `WeeklyReportResponse` into a pure pdfmake template `collectionsWeeklyPdf(...)`. The template borrows `ficha.report.ts` visual style (Artidev header, weekday columns, week-range subtitle, customer rows, weekly total column) without re-importing it; the legacy endpoint stays untouched. The web view adds a download button beside `Hoy` reading from an explicit `weeklyAppliedQuery` snapshot so PDF scope always matches the rendered table.

## Architecture Decisions

| Decision | Choice | Alternative | Rationale |
|---|---|---|---|
| Service split | New `CollectionsWeeklyPdfService`, no edit to `ReportService` | Extend `getFichaPagos` | Single-responsibility; avoids regressing the blank cobrador sheet and its 3 `fichaReport` callers. |
| Template file | New `documents/collections-weekly-pdf.ts` pure function | Reuse `fichaReport()` with optional map | No conditional branching inside `fichaReport`; matches exploration §Approaches. |
| Filename safety | `sanitizeFilenameSlug`: lowercase, `[^a-z0-9-]+`→`-`, trim, reject `..`/`/` | Modal-style replace | Mirrors `ZoneFichaModal.sanitizeFilename`; hardened against traversal/CRLF. |
| Store snapshot | Add `weeklyAppliedQuery: CollectionsWeeklyQuery \| null` set on `fetchWeekly` success (uses response-normalized `weekStart`) | Re-read live filters at click | Spec requires "exact loaded scope"; live filters drift between render and click. |
| Web test runner | Reject. `yarn lint` + `yarn build` + manual harness. | Add Vitest/Jest | No runner in repo; not justified for ~70 LOC. |
| PEN formatting | `S/ ${n.toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2})}` | Web `fCurrency` | API-side template; matches `fichaReport` style without web utils in Nest. |

## Data Flow

Controller handler → `CollectionsWeeklyPdfService.generate(query, tz)` → (a) `data = CollectionsWeeklyReportService.findOne(query, tz)`, (b) `zone = ZoneService.findOne(query.zoneId)` (404 if missing), (c) `doc = collectionsWeeklyPdf({data, zone, tz})`, (d) `printer.createPdf(doc)`. Response sets `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="reporte-cobranzas-${slug}-${weekStart}-${weekEnd}.pdf"`, then pipes the doc. `findOne()` is the single source of truth; `ZoneService.findOne` is the only new dependency.

## Interfaces / Contracts

```ts
type CollectionsWeeklyPdfInput = { data: WeeklyReportResponse; zoneName: string; tz: string };
export const collectionsWeeklyPdf: (i: CollectionsWeeklyPdfInput) => TDocumentDefinitions;

// CollectionsWeeklyPdfService has one method:
//   generate(query: CollectionsWeeklyQueryDto, tz: string): Promise<PDFKit.Document>
// Deps: CollectionsWeeklyReportService, ZoneService, PrinterService.
```

Template: portrait, 15-col table `[auto, *, auto×5, auto×7, auto]` (Nro, Cliente, Tipo crédito, Fecha crédito, Fecha venc., Monto, Restante, 7 weekday boxes, Total sem.). `headerRows: 1` so weekday headers repeat on page breaks. Day cells: empty when `cell.amount === null`, else `S/ <formatted>`. Footer row carries `totals.byDay[d].amount` and `totals.totalCollected`.

## File Changes

| File | Repo | Action |
|---|---|---|
| `api/src/report/documents/collections-weekly-pdf.ts` | api | Create (template) |
| `api/src/report/collections-weekly-pdf.helpers.ts` | api | Create (`sanitizeFilenameSlug`, PEN formatter) |
| `api/src/report/collections-weekly-pdf.service.ts` | api | Create |
| `api/src/report/report.controller.ts` | api | Modify (+handler, ctor deps) |
| `api/src/report/report.module.ts` | api | Modify (+provider; `ZoneModule` already imported) |
| `api/test/report/collections-weekly-pdf.service.spec.ts` | api | Create |
| `api/test/report/collections-weekly-pdf.spec.ts` | api | Create (TZ/empty/sanitize) |
| `web/src/services/report.service.ts` | web | Modify (+`getCollectionsWeeklyReportPdfService`, `responseType:'blob'`, fallback filename) |
| `web/src/store/useCollectionsReportStore.ts` | web | Modify (+`weeklyAppliedQuery` set on `fetchWeekly` success from `response.weekStart`) |
| `web/src/sections/collections-report/CollectionsReportView.tsx` | web | Modify (+button beside `Hoy`, weekly-only, disabled when no applied query or downloading; success `createObjectURL`→click→`revokeObjectURL`; failure toast + restore) |

No migrations. No new dependencies.

## Testing Strategy

**API strict-TDD.** Service spec: (1) returns pdfDoc from `createPdf`; (2) forwards `query/tz` to `findOne`; (3) `ZoneService` 404 path. Template spec: TZ-aware day labels, missing dates → `—`, empty week zero totals, slug strips unsafe chars + rejects `..`. Optional supertest: 200+headers, ADMIN 403, 400 on bad `weekStart`. Gate: `yarn lint && yarn test && yarn build`.

**Web.** No runner. Gate: `yarn lint && yarn build`. Harness (in `tasks.md`): load weekly → click → expect `reporte-cobranzas-<zone>-<weekStart>-<weekEnd>.pdf`; toggle filters after load → button still uses applied scope; empty week downloads with zero totals.

## Threat Matrix

N/A — HTTP route only. No documentation-like executable paths, git selectors, commit/push state, PR automation, executable-file classification, or subprocess/shell boundaries. Per `references/threat-matrix.md`, no row is Applicable; no RED tests invented for N/A rows.

## Migration / Rollout

No schema changes. Guarded by `@Auth(ValidRole.ADMIN)`. Rollback per repo in one working-tree change: api drops the new handler + service + template + helpers + tests; web drops the button, the new service function, the `weeklyAppliedQuery` store field. Legacy `fichaReport()` and JSON endpoints stay untouched.

## Cross-repo apply sequencing (no branches, no commits)

One canonical change folder `api/openspec/changes/weekly-collections-report-pdf/`. Slice 1 (API): `sdd-apply` against `api/`, create four new files, edit controller + module, `yarn lint && yarn test`. Slice 2 (Web): `sdd-apply` against `web/`, touch three web files, `yarn lint && yarn build`, browser smoke per harness. `sdd-verify` cross-repo after both slices pass. Tasks/progress live in the API change folder; web references it by path, no OpenSpec copy in web. No git operations.

## Open Questions

None. Filename, orientation, placement, store snapshot, test runner all locked. Optional follow-up (out of scope): landscape layout if portrait cramps.
