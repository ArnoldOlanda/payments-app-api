# Exploration: Weekly Collections Report PDF

## Topic

Add a direct PDF download of the Admin-only weekly collections report
(`/report/collections`, weekly mode) without re-implementing the report's
data path. Reuse the existing JSON contract as the single source of truth.

## Current State

- `api/src/report/collections-weekly-report.service.ts` already exposes
  `findOne(query, tz)` returning `WeeklyReportResponse`:
  `weekStart`, `weekEnd`, `days[]`, `rows[]` (per account, with
  `customer`, `days[7]` cells `{date, amount, paymentIds, paymentCount}`,
  `weeklyTotal`), and `totals { totalCollected, paymentCount, byDay[] }`.
- `api/src/report/report.controller.ts` already wires
  `GET /report/collections/weekly` with `@Auth(ValidRole.ADMIN)` and
  `@CurrentTimezone()`, returning the JSON envelope.
- `api/src/report/documents/ficha.report.ts` and
  `api/src/report/report.service.ts` already produce a PDF for the
  legacy "Ficha de Pagos" using pdfmake via `PrinterService`. It is a
  blank weekly sheet (7 weekday columns empty by design, no payment
  amounts) scoped to a single cobrador.
- `api/src/printer/printer.service.ts` provides a single
  `createPdf(TDocumentDefinitions)` factory shared by every PDF in the
  codebase.
- `api/openspec/specs/collections-report/spec.md` is the canonical
  spec for the JSON view. It does NOT mention PDF; the existing
  `collections-report` bounded context is JSON-only.
- Web: `web/src/store/useCollectionsReportStore.ts` keeps the latest
  `WeeklyReportResponse` in `weekly` state. The current view
  (`web/src/sections/collections-report/CollectionsReportView.tsx`) has
  a header block with title, mode toggle, and a "Hoy" button — there is
  no download button today.
- Web: `web/src/services/report.service.ts` only has
  `getCollectionsReportService` and `getCollectionsWeeklyReportService`
  (both JSON).
- OpenSpec is API-only: `web/openspec/` does not exist. All artifacts
  for this change live under
  `api/openspec/changes/weekly-collections-report-pdf/`.

## Reconciliation with existing `collections-report` spec

This change is an EXTENSION of `collections-report`, not a competing
spec. The canonical spec stays JSON-shaped; we add a PDF derivation
behavior that uses the same data contract. Concretely:

- No requirement in `openspec/specs/collections-report/spec.md` needs
  to be `MODIFIED` or `REMOVED`.
- The new behavior is captured as `ADDED Requirements` in the change's
  `specs/collections-report/spec.md` delta so it lives under the same
  bounded context and merges cleanly during archive.
- The delta is: (1) a new endpoint `GET /report/collections/weekly/pdf`
  with the same query params and ADMIN-only restriction, (2) a content
  rule that day cells MUST equal the sum of `payment.amount` for that
  account/day (matching the existing JSON contract), (3) a zero-totals
  rule that a valid week with zero payments still produces a downloadable
  PDF, (4) ADMIN-only access (already enforced by `@Auth(ADMIN)` and
  carried forward).

## Affected Areas

- `api/src/report/report.controller.ts` — add `GET /report/collections/weekly/pdf` handler.
- `api/src/report/collections-weekly-report.service.ts` (or new sibling `collections-weekly-pdf.service.ts`) — new method that calls existing `findOne()` and pipes a pdfmake doc through `PrinterService`. Reuses the JSON service, no duplicated queries.
- `api/src/report/documents/collections-weekly-pdf.ts` — new template. Inspired by `ficha.report.ts` for visual style, but content is populated with actual collected amounts.
- `api/src/report/dto/collections-weekly-query.dto.ts` — already covers `weekStart`, `zoneId`, `userId`; no new DTO needed unless the controller decides to expose a separate `format` flag (not required by current user decisions).
- `api/src/report/report.module.ts` — register new provider if a new service class is added.
- `api/test/report/collections-weekly-pdf.service.spec.ts` — RED/GREEN/TRIANGULATE for the new service method.
- `api/test/report/collections-weekly-pdf.spec.ts` — TZ-aware PDF rendering assertions (mirrors `ficha.report.spec.ts`).
- `web/src/services/report.service.ts` — new `getCollectionsWeeklyReportPdfService(query)` returning a `Blob` and triggering a browser download.
- `web/src/sections/collections-report/CollectionsReportView.tsx` — new download button in the weekly-mode header (next to "Hoy"), disabled until `weekly` is loaded.
- `web/src/store/useCollectionsReportStore.ts` — optional: expose `weeklyDate` + `weeklyZoneId` so the button can build the query without re-deriving state.

No changes to the canonical `collections-report/spec.md` beyond the `ADDED Requirements` delta in the change folder.

## Approaches

1. **Dedicated weekly-PDF endpoint with a new template that reuses the JSON service**
   - New `GET /report/collections/weekly/pdf` returns `application/pdf`.
   - Service method reuses `CollectionsWeeklyReportService.findOne()` (no duplicated TypeORM query) and feeds the response into a new pdfmake document definition.
   - Visual language mirrors `ficha.report.ts` (Artidev header right, weekday column headers, week range subtitle, customer rows, weekly total column) but day cells show the actual collected amount per the JSON contract.
   - Pros: zero duplicated query logic, single source of truth for the data contract, clean reuse boundary, easy to test (template test + service test that mocks `findOne`), TZ handling already proven on the JSON path.
   - Cons: small overlap with `ficha.report.ts` for visual style — we accept a tiny duplication of header/footer composition to keep the data template single-responsibility.
   - Effort: Low (~250 API LOC, ~60 web LOC).

2. **Reuse/extend the existing `ficha-pagos` flow**
   - Generalize `ReportService.getFichaPagos()` to accept an optional weekly payment map and render it in the existing 7-day columns.
   - Reuse `fichaReport()` with a new optional `paymentsByAccountDay` input; the function branches to populate cells when the map is provided.
   - Pros: maximum reuse of an already-tested pdfmake wrapper, no new template file.
   - Cons: `fichaReport()` is a blank sheet designed for a cobrador who fills it by hand; mixing "filled" vs "blank" in one function blurs its single responsibility and risks regressing the legacy endpoint. The legacy controller also depends on `request.user.id` + `userService.getAccounts(id, zoneId)` semantics that don't map onto the weekly admin report (per-account list comes from the zone, not from the cobrador). Adds conditional branching and JSON-shape divergence. Test surface doubles because every existing `ficha.report.spec.ts` assertion must keep passing.
   - Effort: Medium (~280 API LOC, more test churn, broader regression surface).

## Recommendation

**Approach 1 (Dedicated weekly-PDF endpoint with a new template).**

Reuse boundary:
- Data: `CollectionsWeeklyReportService.findOne()` is the ONLY data source.
- PDF primitives: `PrinterService.createPdf()` is reused as-is.
- Visual language: new template `collections-weekly-pdf.ts` borrows the header/footer composition and weekday-column shape from `ficha.report.ts` but never re-imports it. No conditional logic in `ficha.report.ts`; the legacy endpoint stays untouched.
- DTO: reuses `CollectionsWeeklyQueryDto` — no new DTO is needed because the query params (`weekStart`, `zoneId`, `userId`) are identical to the JSON endpoint.

Why this wins:
- Single source of truth for the weekly data contract. The PDF stays in lockstep with what the UI already shows because both consume the same JSON shape.
- TZ correctness is already proven on `findOne()`. The PDF layer only formats strings — no new TZ risk.
- TDD discipline matches existing `ficha.report.spec.ts` style: the template test asserts on the document definition's `content` array (TZ-aware day labels, missing-account handling, totals row).
- The web button uses the existing `weekly` state in the store, so the download always matches what the operator just saw. No extra fetches, no state divergence.

## Cross-repo artifact / apply constraints

- API-only OpenSpec root (`/mnt/e/work/payments_app/api/openspec`). Web has no OpenSpec folder; web edits live outside OpenSpec governance.
- Allowed edit roots for this change:
  - `api/src`
  - `api/test`
  - `api/openspec`
  - `web/src`
- `api/openspec/specs/collections-report/spec.md` is the source of truth. The change's `specs/collections-report/spec.md` delta must be `ADDED Requirements` only — no `MODIFIED` or `REMOVED` blocks, because the JSON behavior is unchanged.
- The change folder `api/openspec/changes/weekly-collections-report-pdf/` already follows the convention (`exploration.md`, then `proposal.md`, then `specs/collections-report/spec.md`, then `design.md`, then `tasks.md`).
- No commits and no branch are created during apply. The orchestrator verifies locally and the user handles git operations.

## Estimated changed-line range

- API service + controller wiring: ~60 lines (`report.controller.ts` +50, `report.module.ts` +10 if new provider class).
- API new template (`collections-weekly-pdf.ts`): ~140 lines (header, week-range subtitle, weekday headers, per-day cells, totals row, currency formatting helpers).
- API service spec (RED → GREEN → TRIANGULATE): ~90 lines.
- API template spec (TZ-aware assertions, mirroring `ficha.report.spec.ts`): ~60 lines.
- Web service function: ~30 lines (axios with `responseType: 'blob'`, filename from `weekStart`, error normalization).
- Web button + state read in `CollectionsReportView.tsx`: ~40 lines (button next to "Hoy", disabled state, download trigger, toast on error).
- **Total: ~420 lines authored across both repos, with goldens/tests counted in.**

That is **AT the 400-line review budget**. Recommended mitigation:

- Split into two chained PR slices (low risk of crossing the budget):
  - **Slice 1 (api)**: new template, new service method, controller endpoint, module wiring, both test files. ~350 lines. Independent, fully verifiable via `yarn test` and `yarn lint`.
  - **Slice 2 (web)**: service function + button + store accessor. ~70 lines. Single PR, fast review.
- Decision needed before apply: **Yes** — orchestrator should confirm the chained-PR split before `sdd-apply`, since the API-only slice alone is ~350 lines and the web slice depends on the API contract being merged.
- Chained PRs recommended: **Yes**.
- 400-line budget risk: **Medium** (the aggregate is just over 400, the per-slice counts are both well under 400).

## Risks

- **Review budget proximity**: aggregate ~420 lines is just over 400. Mitigation: enforce the chained-PR split described above; do not let either slice grow without revisiting the budget.
- **PDF orientation**: 7 day columns plus account metadata in portrait may force font/column shrinkage that hurts readability. If a follow-up task surfaces this, landscape is a low-risk extension (pdfmake's `pageOrientation` is one line). Surface as a small follow-up question during proposal review, NOT a blocker.
- **Empty week PDF**: the existing JSON service returns a valid `WeeklyReportResponse` even when no accounts/payments match. The PDF template MUST render a clean week with zero totals (header + empty body + zero byDay row). One test pins this contract.
- **Filename consistency**: not yet specified. Recommend `cobranzas-semana-<weekStart>.pdf` to match the Spanish UI copy and the existing `formatWeekRange` helper. Surface as a small proposal-review confirmation, not a blocker.
- **Authorization drift**: new endpoint MUST keep `@Auth(ValidRole.ADMIN)` exactly as the JSON sibling does. Test pins this; reviewer should reject any PR that drops the guard.
- **Soft-delete semantics**: `findOne()` already excludes `deletedAt IS NOT NULL` for both payments and accounts. The PDF inherits this for free; no new test required, but the proposal should call it out so reviewers know the contract carries through.
- **Web auth header / axios blob**: web already uses an `API` axios instance with credentials; the new service must use the same instance and set `responseType: 'blob'` so the download triggers correctly. Surface in design so reviewers don't see a one-off fetch.

## Genuinely unresolved product decisions (do NOT reopen the locked ones)

These are small and can be confirmed during `sdd-propose` or `sdd-design` review, not blockers:

- **PDF orientation** (portrait vs landscape). Recommend portrait to match the existing `ficha.report.ts`; landscape is a follow-up if readability regresses.
- **Filename pattern**. Recommend `cobranzas-semana-<weekStart>.pdf`.
- **Whether the button lives in the header toolbar or inside the results card**. Recommend header toolbar (next to "Hoy") to match operator workflow — same row, same discoverability.

Locked by user, do not reopen:
- Access stays Admin-only.
- Day cells print actual `payment.amount` (current `Payment.amount` semantics).
- No expected-installment comparison.
- Empty week is a valid PDF with zero totals.
- Direct PDF download, no preview modal.
- Button lives on the existing web weekly collections report.
- No Git branch, no commits.

## Ready for Proposal

Yes. Next phase: `sdd-propose`. The orchestrator should:
1. Confirm the chained-PR split (api slice first, web slice second) BEFORE calling `sdd-tasks`, because the aggregate forecast is just over the 400-line budget.
2. Confirm the three small open items above (orientation, filename, button placement) during proposal review.
3. Pass `delivery_strategy: chained-pr` to `sdd-tasks` and `sdd-apply`.

## Evidence paths and symbols

- `api/src/report/collections-weekly-report.service.ts:60` — `CollectionsWeeklyReportService.findOne()`
- `api/src/report/report.controller.ts:45-52` — existing weekly JSON handler
- `api/src/report/dto/collections-weekly-query.dto.ts:6` — `CollectionsWeeklyQueryDto`
- `api/src/report/documents/ficha.report.ts:13` — `fichaReport()` (visual reference, not reused)
- `api/src/printer/printer.service.ts:18` — `PrinterService.createPdf()`
- `api/src/report/report.service.ts:34` — `ReportService.getFichaPagos()` (existing PDF flow, not extended)
- `api/openspec/specs/collections-report/spec.md` — canonical JSON spec to extend via `ADDED Requirements`
- `web/src/sections/collections-report/CollectionsReportView.tsx:56` — `CollectionsReportView()` (target view for the download button)
- `web/src/store/useCollectionsReportStore.ts:103` — `useCollectionsReportStore` (provides `weekly`, `weeklyDate`, `weeklyZoneId`)
- `web/src/services/report.service.ts:50` — `getCollectionsWeeklyReportService` (sibling service to mirror)
- `api/openspec/changes/archive/2026-07-25-add-collections-report/tasks.md` — precedent for the chained-PR budget forecast
- `api/openspec/changes/enforce-one-payment-per-account-day/design.md` — precedent for the cross-repo budget breakdown table
