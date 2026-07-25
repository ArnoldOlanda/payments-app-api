# Design: Add collections report

Implements the spec at
`openspec/changes/2026-07-25-add-collections-report/specs/collections-report/spec.md`.

## Technical Approach

The new endpoint is a pure read with aggregation in SQL via TypeORM
`QueryBuilder`. No row lock, no transaction. A single round-trip returns
rows + total via `getManyAndCount()`. Date boundaries are resolved with
the existing TZ-aware wrapper (`api/src/common/datetime/tempo.ts`) so the
actor's calendar day drives the range. The frontend uses the existing
`useUserStore` (Admin-only) to populate the cobrador selector, then a
derived `ZoneFilter` limited to the cobrador's zones.

## Architecture Decisions

### Decision: Place the endpoint under `ReportController`

**Choice**: New handler `@Get('collections')` in
`api/src/report/report.controller.ts`.
**Alternatives considered**: new module
`api/src/collections-report/collections-report.module.ts`.
**Rationale**: `report` already owns PDF reports and shares the same
TZ-aware boundary helper. Adding a sibling endpoint avoids a new module
boundary, a new entry in `app.module.ts`, and matches the team's pattern
of grouping read-only reporting under `report`.

### Decision: Service lives in its own file

**Choice**: `api/src/report/collections-report.service.ts` exporting
`CollectionsReportService`.
**Alternatives considered**: extend `ReportService` directly.
**Rationale**: keeps `ReportService` focused on PDF generation; the new
service is independent, easier to mock in tests, and avoids importing
`Payment` / `Account` / `Customer` repositories into the PDF code path.

### Decision: Page is 1-indexed, mirroring `account.service.findAll`

**Choice**: `page` default 1, 1-indexed; `limit` default 10, capped at 200.
**Alternatives considered**: 0-indexed (matches `useCustomerStore`).
**Rationale**: `account.service.findAll` already uses 1-indexed
(`api/src/account/account.service.ts:73`); the new report UI follows the
`AccountView` pattern (`web/src/sections/account/AccountView.tsx:176`),
so consistency wins.

### Decision: Sort order is `(payment.date DESC, payment.createdAt DESC, payment.id DESC)`

**Choice**: Triple-key stable order.
**Alternatives considered**: just `payment.date DESC`.
**Rationale**: two payments with the same `date` (operator entered them
on the same day) need a deterministic order for pagination; `createdAt`
breaks ties; `id` is the final deterministic tie-breaker.

### Decision: Helper `parseCalendarDayToInstant` in `common/datetime/tempo.ts`

**Choice**: extend `api/src/common/datetime/tempo.ts` with a function that
takes a `YYYY-MM-DD` string, an IANA `tz`, and a boundary hint
(`'start' | 'end'`) and returns a `Date` resolving to local midnight /
local 23:59:59.999.
**Alternatives considered**: parse inside the service via `new Date(s)`;
or accept ISO timestamps instead of date-only.
**Rationale**: the existing wrapper already exposes the primitives
(`dayStart`/`dayEnd`); threading the same helper through the new endpoint
keeps TZ behavior consistent with `analytics.service.getCollections`
(`api/src/analytics/analytics.service.ts:122`) and avoids the
`new Date('YYYY-MM-DD')` UTC pitfall.

### Decision: Soft-deleted payments always excluded

**Choice**: `andWhere('payment.deletedAt IS NULL')` is unconditional.
**Alternatives considered**: include soft-deleted with a flag.
**Rationale**: matches `account.service.update` (`api/src/account/account.service.ts:184`)
and the test expectation in `analytics.service.recent-payments.spec.ts`.
A future change can add the flag if the business asks for "pagos anulados".

## Data Flow

```
Admin (web)
   │
   ▼
CollectionsReportView ──▶ useCollectionsReportStore
                              │ fetch(query)
                              ▼
                          report.service.getCollectionsReportService
                              │ GET /report/collections?from&to&userId&zoneId&page&limit
                              ▼
                          ReportController (api/src/report/report.controller.ts)
                              │ @Auth(ADMIN), @CurrentUser(), @CurrentTimezone()
                              ▼
                          CollectionsReportService
                              │ build QueryBuilder over
                              │   payment → account → customer → zone → user
                              │ apply filters + parseCalendarDayToInstant(from/to, tz)
                              ▼
                          getManyAndCount()
                              │
                              ▼
                          { data, meta }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/src/report/dto/collections-report-query.dto.ts` | Create | DTO con `from?`, `to?`, `userId?`, `zoneId?`, `page`, `limit` |
| `api/src/report/collections-report.service.ts` | Create | Query builder + meta |
| `api/src/report/report.controller.ts` | Modify | Add `@Get('collections')` handler |
| `api/src/report/report.module.ts` | Modify | Register `CollectionsReportService` and import `PaymentModule`, `CustomerModule` |
| `api/src/common/datetime/tempo.ts` | Modify | Add `parseCalendarDayToInstant` |
| `api/src/migrations/1785000000000-AddCollectionsReportIndexes.ts` | Create | Índices parciales |
| `api/test/report/collections-report-query.dto.spec.ts` | Create | RED: DTO validation |
| `api/test/report/collections-report.service.spec.ts` | Create | RED: service behavior |
| `web/src/auth/role-access.ts` | Modify | Add `reports.read` feature + Admin only |
| `web/src/routes/sections.tsx` | Modify | Lazy `CollectionsReportPage` + ruta |
| `web/src/layouts/config-nav-dashboard.tsx` | Modify | Item sidebar |
| `web/public/assets/icons/navbar/ic-report.svg` | Create | Ícono |
| `web/src/interfaces/report.ts` | Create | Tipos |
| `web/src/services/report.service.ts` | Create | `getCollectionsReportService` |
| `web/src/store/useCollectionsReportStore.ts` | Create | Zustand store |
| `web/src/pages/collections-report.tsx` | Create | Wrapper |
| `web/src/sections/collections-report/CollectionsReportView.tsx` | Create | Vista principal |
| `web/src/sections/collections-report/CollectionsReportTableRow.tsx` | Create | Fila |
| `web/src/sections/collections-report/CollectionsReportCard.tsx` | Create | Card móvil |

## Interfaces / Contracts

### Backend DTO

```ts
export class CollectionsReportQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @IsOptional()
  @IsUUID('4')
  zoneId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10; // service caps to 200
}
```

### Backend Response

```ts
{
  data: Array<{
    id: string;
    paymentDate: string;        // 'YYYY-MM-DD' in actor TZ
    registeredAt: string;       // ISO timestamp
    loanAmount: number;         // account.amount
    paidAmount: number;         // payment.amount
    zone: { id: string; name: string } | null;
    customer: { id: string; name: string; lastName: string };
    user: { id: string; name: string } | null;
  }>;
  meta: { total: number; page: number; limit: number; totalPages: number; currentPage: number };
}
```

### Web Store

```ts
interface State {
  items: CollectionsReportItem[];
  meta: CollectionsReportMeta;
  isLoading: boolean;
  error: string | null;
  filters: { from?: string; to?: string; userId?: string; zoneId?: string };
}
interface Actions {
  setFilters(filters: Partial<State['filters']>): void;
  fetch(page: number, limit: number): Promise<void>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| API unit (DTO) | `from > to` rejected, malformed date rejected, limit/positive ints | Jest + `class-validator` |
| API unit (service) | Default range, `from/to` boundaries (TZ-aware), userId filter, zoneId filter, combined filters, pagination meta, sort order, soft-deleted excluded, admin-only via controller | Jest + mocked QueryBuilder (pattern from `test/analytics/analytics.service.recent-payments.spec.ts`) |
| Web build | Typecheck | `yarn tsc --noEmit` |
| Web lint | ESLint + Prettier | `yarn lint`, `yarn fm:check` |
| Manual | Default range (today), filter by user clears zone, paginate, error toast | Dev server + manual clicks |

## Migration / Rollout

Single migration adding partial indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_payment_date_where_alive
  ON payment (date DESC) WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_user_date
  ON payment ("userId", date DESC) WHERE "deletedAt" IS NULL;
```

FK indexes (`payment.accountId`, `account.customerId`, `customer.zoneId`,
`payment.userId`) already exist via FK constraints (Postgres auto-indexes
FK columns) — verified at `api/src/migrations/1736890725855-init.ts:42-47`.

No feature flag. Land in a single PR.

## Open Questions

None remaining. Scope locked to JSON endpoint + screen; PDF export is
explicitly deferred.