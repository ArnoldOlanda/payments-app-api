# Tasks: Add collections report

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~520 (api ~320, web ~200) |
| 400-line budget risk | Med — split backend PR and frontend PR |
| Chained PRs recommended | Yes (api first, web second) |
| Suggested split | chained (api → web) |
| Delivery strategy | chained-pr |
| Chain strategy | api-first, web-after |

## Strict TDD Mode

`STRICT TDD MODE IS ACTIVE. Test runner (api): yarn test. Follow RED, GREEN, TRIANGULATE, REFACTOR. Record evidence.`

- **RED**: Task 1.1 — failing DTO spec.
- **GREEN**: Task 3.1 — minimal DTO + helper to make 1.1 pass.
- **TRIANGULATE**: Tasks 1.2..1.N — edge cases force generalization.
- **REFACTOR**: Task 6.1 — extract reusable helper if duplication emerges.

## Phase 1 — Backend foundation

- [ ] 1.1 Add failing DTO tests in `api/test/report/collections-report-query.dto.spec.ts`:
      - [ ] rejects `from > to`
      - [ ] rejects malformed `YYYY-MM-DD`
      - [ ] rejects non-UUID `userId`/`zoneId`
      - [ ] rejects `limit < 1` and `page < 1`
      - [ ] defaults page=1, limit=10
- [ ] 1.2 Add `parseCalendarDayToInstant(value, tz, boundary)` in
      `api/src/common/datetime/tempo.ts` (returns `Date` for `start` or
      `end` of the calendar day in `tz`).
- [ ] 1.3 Add failing unit test
      `parseCalendarDayToInstant('2026-07-25', 'Asia/Tokyo', 'start')` resolves
      to `2026-07-25T00:00:00+09:00` in `api/test/common/datetime/tempo.spec.ts`.

## Phase 2 — Backend service (TDD)

- [ ] 2.1 Add failing service spec in
      `api/test/report/collections-report.service.spec.ts`:
      - [ ] defaults range to today in actor TZ
      - [ ] `from/to` honored with TZ-correct boundaries
      - [ ] `userId` adds `payment.userId = :userId`
      - [ ] `zoneId` adds `customer.zoneId = :zoneId`
      - [ ] combined filters apply AND
      - [ ] pagination returns total + rows
      - [ ] sort order is `(payment.date DESC, payment.createdAt DESC, payment.id DESC)`
      - [ ] soft-deleted payments excluded
      - [ ] `limit > 200` capped to 200
- [ ] 2.2 GREEN: implement `CollectionsReportService` in
      `api/src/report/collections-report.service.ts` (QueryBuilder + meta).
- [ ] 2.3 Add `@Auth(ValidRole.ADMIN)` handler
      `@Get('collections')` in `api/src/report/report.controller.ts`.
- [ ] 2.4 Register `CollectionsReportService` in `api/src/report/report.module.ts`
      (import `PaymentModule`, `CustomerModule`).

## Phase 3 — Migration

- [ ] 3.1 Generate migration `1785000000000-AddCollectionsReportIndexes.ts`
      via `yarn migration:generate` (or hand-write if dev DB unavailable).
      Contains:
      - `idx_payment_date_where_alive` ON payment(date DESC) WHERE deletedAt IS NULL
      - `idx_payment_user_date` ON payment(userId, date DESC) WHERE deletedAt IS NULL

## Phase 4 — Backend verify

- [ ] 4.1 Run `yarn lint`; resolve new errors.
- [ ] 4.2 Run `yarn test`; all specs green, no regression.
- [ ] 4.3 Run `yarn tsc --noEmit` (no build per project rule).

## Phase 5 — Web integration

- [ ] 5.1 Add `reports.read` to `Feature` and `ROLE_FEATURES[ADMIN]`
      in `web/src/auth/role-access.ts`.
- [ ] 5.2 Add `CollectionsReportPage` lazy + route entry in
      `web/src/routes/sections.tsx`.
- [ ] 5.3 Add sidebar item in `web/src/layouts/config-nav-dashboard.tsx`
      and create `web/public/assets/icons/navbar/ic-report.svg`.
- [ ] 5.4 Create `web/src/interfaces/report.ts`
      (`EndpointCollectionsReportItem`, `CollectionsReportResponse`,
      `CollectionsReportQuery`).
- [ ] 5.5 Create `web/src/services/report.service.ts` with
      `getCollectionsReportService(query)`.
- [ ] 5.6 Create `web/src/store/useCollectionsReportStore.ts`.
- [ ] 5.7 Create `web/src/pages/collections-report.tsx` wrapper.
- [ ] 5.8 Create `web/src/sections/collections-report/CollectionsReportView.tsx`:
      - [ ] user selector via existing `useUserStore`
      - [ ] dependent `ZoneFilter` with `zones={selectedUser?.zones ?? []}`
      - [ ] date inputs `from`/`to` with `YYYY-MM-DD`
      - [ ] `Consultar` button validates range and calls `fetch(1, limit, filters)`
      - [ ] table for desktop, cards for mobile, `TablePagination` always
      - [ ] error/success via `Toast` ref
- [ ] 5.9 Create `CollectionsReportTableRow.tsx` and
      `CollectionsReportCard.tsx` with the 8 columns.

## Phase 6 — Web verify

- [ ] 6.1 Run `yarn lint`; resolve new errors.
- [ ] 6.2 Run `yarn fm:check`.
- [ ] 6.3 Run `yarn tsc --noEmit` (no build per project rule).
- [ ] 6.4 Manual smoke: default today, user filter clears zone,
      pagination, error toast.

## Phase 7 — Lifecycle (parent)

- [ ] 7.1 Open PR #1 (api): `feat(api): collections report endpoint`.
- [ ] 7.2 Open PR #2 (web): `feat(web): collections report screen`.
- [ ] 7.3 After merge: `sdd-archive` to promote
      `specs/collections-report/spec.md` into canonical
      `openspec/specs/collections-report/spec.md`.

## Dependency Graph

```text
1.1 (RED DTO)
  └── 1.2, 1.3 (helpers + RED helper test)
        └── 2.1 (RED service)
              └── 2.2 (GREEN service)
                    ├── 2.3, 2.4 (controller + module wiring)
                    │     └── 3.1 (migration)
                    │           └── 4.x (verify api)
                    │                 └── 5.x (web, depends on api)
                    │                       └── 6.x (verify web)
                    └── 1.x complete (refactor if needed)
```

The web phase depends on the api being merged (or at least the contract
locked). Single change, two chained PRs.

## Rollback Plan

Two PRs, revert in reverse order:
- Revert web PR → screen disappears, API endpoint stays.
- Revert api PR → endpoint goes away, no DB impact (migration only
  adds indexes; reverting the migration is optional — Postgres reverts
  drop the indexes).