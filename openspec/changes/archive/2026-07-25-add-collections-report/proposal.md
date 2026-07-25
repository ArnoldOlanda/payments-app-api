# Proposal: Add collections report

## Intent

La operación necesita una pantalla de **reporte de cobranzas** que liste los pagos
registrados en una fecha o rango, filtrando por usuario cobrador y por zona.
El reporte debe permitir, además, descargar los pagos en columnas claras
(`Nro | Fecha | Hora | Monto prestado | Zona | Cliente | Usuario | Monto pagado`)
y ser exclusivo para `ADMIN`.

Hoy no existe un endpoint que combine:

- Filtro por `from` / `to` AND `userId` AND `zoneId` AND paginación.
- La columna `monto_prestado` (`account.amount`) junto al pago (`payment.amount`).

`GET /analytics/recent-payments` está cerca pero no pagina (`take(limit)`,
`api/src/analytics/analytics.service.ts:231`); agregarle paginación rompería el
consumidor móvil (`mobile/CobranzasDelDia/...`).

## Scope

### In Scope

- Nuevo endpoint `GET /report/collections` con paginación, filtros
  `from`/`to`/`userId`/`zoneId`, default a hoy, exclusivo `ADMIN`.
- Helper `parseCalendarDayToInstant(date, tz, boundary)` en
  `api/src/common/datetime/tempo.ts` para evitar drift de día civil al parsear
  `YYYY-MM-DD` en distintos timezones.
- Migración TypeORM con índices nuevos en `payment.date`,
  `payment.userId`, `account.customerId`, `customer.zoneId` (los joins del query).
- Pantalla web `/report/collections`: filtros (fecha desde/hasta, usuario,
  zona dependiente), tabla/cards paginadas, botón **Consultar**, errores vía
  `Toast`, permisos via `reports.read`.
- Entrada nueva en sidebar (`web/src/layouts/config-nav-dashboard.tsx`) y
  feature `reports.read` para `ADMIN` en `web/src/auth/role-access.ts`.

### Out of Scope

- Exportación a PDF / CSV / Excel del reporte. Queda como change aparte.
- Snapshot histórico de `account.amount`/`interest` en cada `payment`.
- Migración de `float8` a `numeric(14,2)` para `account.amount`/`interest`.
- Cache de resultados del reporte.
- Acceso de `PRESTAMISTA` al reporte.

## Capabilities

### New Capabilities

- `collections-report`: nuevo bounded context que cubre el reporte de
  cobranzas JSON consumido por la pantalla `/report/collections`. Tendra
  `openspec/specs/collections-report/spec.md` cuando se archive.

### Modified Capabilities

- `report`: cambio menor, el módulo `report` agrega un nuevo handler
  (`@Get('collections')`) y un nuevo DTO. La spec canónica del bounded
  context `report` aún no existe (sólo el delta del change `add-user-timezone`),
  por lo que el delta se escribe contra el placeholder del report module.

## Approach

Backend: nuevo `CollectionsReportService` que arma un `QueryBuilder` sobre
`payment → account → customer → zone → user`, con `andWhere` por
`payment.userId` y `customer.zoneId`, `BETWEEN` con `parseCalendarDayToInstant`,
orden estable `(payment.date DESC, payment.createdAt DESC, payment.id DESC)` y
`getManyAndCount()`. Devuelve `{ data, meta }` con paginación 1-indexed
(consistente con `account.service.findAll`,
`api/src/account/account.service.ts:73`). El controller se monta en
`ReportController` (`api/src/report/report.controller.ts:8`) con
`@Auth(ValidRole.ADMIN)`, `@CurrentUser()`, `@CurrentTimezone()`.

Frontend: nuevo `useCollectionsReportStore` (mismo patrón que
`useAccountStore`, `web/src/store/useAccountStore.ts:24`), selector de usuario
que reutiliza `useUserStore` (existente, Admin-only), `ZoneFilter` con
`zones={selectedUser?.zones ?? []}`, botón **Consultar** que dispara
`fetch(1, limit, filters)`. Tabla y cards siguen el layout de
`AccountView.tsx:100`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/src/report/report.controller.ts` | Modified | Nuevo handler `@Get('collections')` |
| `api/src/report/report.module.ts` | Modified | Importa `PaymentModule`, `CustomerModule` (AccountModule y UserModule ya están) |
| `api/src/report/report.service.ts` | Modified | `CollectionsReportService` como provider aparte |
| `api/src/report/dto/collections-report-query.dto.ts` | New | DTO con `from?`, `to?`, `userId?`, `zoneId?`, `page`, `limit` |
| `api/src/report/collections-report.service.ts` | New | Query builder + zona-scope admin |
| `api/src/common/datetime/tempo.ts` | Modified | Helper `parseCalendarDayToInstant` |
| `api/src/migrations/*AddCollectionsReportIndexes.ts` | New | Índices parciales sobre `payment.date` y `payment.userId` |
| `api/test/report/collections-report-query.dto.spec.ts` | New | RED tests del DTO |
| `api/test/report/collections-report.service.spec.ts` | New | RED tests del service |
| `web/src/auth/role-access.ts` | Modified | Feature `reports.read` para ADMIN |
| `web/src/routes/sections.tsx` | Modified | Lazy `CollectionsReportPage` + ruta |
| `web/src/layouts/config-nav-dashboard.tsx` | Modified | Item sidebar |
| `web/public/assets/icons/navbar/ic-report.svg` | New | Ícono |
| `web/src/interfaces/report.ts` | New | Tipos `EndpointCollectionsReportItem`, `CollectionsReportResponse`, `CollectionsReportQuery` |
| `web/src/services/report.service.ts` | New | `getCollectionsReportService(query)` |
| `web/src/store/useCollectionsReportStore.ts` | New | Estado + fetch |
| `web/src/pages/collections-report.tsx` | New | Wrapper `Helmet` + título |
| `web/src/sections/collections-report/CollectionsReportView.tsx` | New | Vista principal |
| `web/src/sections/collections-report/CollectionsReportTableRow.tsx` | New | Fila desktop |
| `web/src/sections/collections-report/CollectionsReportCard.tsx` | New | Card móvil |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Drift de día civil al parsear `YYYY-MM-DD` con `new Date(date)` (UTC) | High | Helper `parseCalendarDayToInstant(date, tz, boundary)` que arma el instante via `dayStart`/`dayEnd` del wrapper TZ-aware |
| Endpoint se vuelve lento sin índices | Med | Migración con `idx_payment_date_where_alive` parcial sobre `deletedAt IS NULL` y `(userId, date)` |
| `payment.userId` legacy en `NULL` rompe reporte | Low | Filtro `userId` se aplica con `andWhere`, valores nulos excluidos naturalmente |
| Concurrencia: dos requests Admin sin lock compartido | Low | Solo lectura, sin lock |
| Frontend dispara requests en cada keystroke de fecha | Med | Botón **Consultar**, no auto-fetch |

## Rollback Plan

Single PR. Revert del commit en `main`. Sin cambios de schema (la migración
agrega índices, no columnas) → no requiere down-migration funcional (los índices
se dropean con el revert). El `web/src/auth/role-access.ts` removiendo
`'reports.read'` cierra el acceso a la pantalla.

## Dependencies

- Ninguna externa. Reutiliza `@formkit/tempo`, `@nestjs/swagger`, MUI, zustand.

## Success Criteria

- [ ] `GET /report/collections` con paginación devuelve filas con todos los
      campos requeridos y `meta.total` correcto.
- [ ] `GET /report/collections` con `from > to` responde `400`.
- [ ] `GET /report/collections` con `limit > 200` queda cappeado a 200.
- [ ] `GET /report/collections` excluye pagos soft-deleted.
- [ ] `GET /report/collections` requiere rol `ADMIN`.
- [ ] `yarn test` y `yarn lint` pasan en api.
- [ ] `yarn lint`, `yarn fm:check`, `yarn tsc --noEmit` pasan en web.
- [ ] La pantalla carga usuarios desde `GET /user`, filtra por rango y
      muestra la zona dependiente del usuario seleccionado.