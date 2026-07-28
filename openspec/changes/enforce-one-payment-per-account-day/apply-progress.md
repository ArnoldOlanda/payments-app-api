# Apply progress: Enforce one payment per account day and operational visibility

## Status

Implementation tasks are complete across API, mobile, and web. Focused and full behavior tests pass. Global verification is partial because repository-baseline e2e/typecheck/lint failures remain outside this change.

## Completed behavior

### API

- Added one-live-payment-per-account/Lima-day enforcement to payment create.
- Added the same enforcement to payment date updates while excluding the edited payment.
- Kept duplicate detection inside existing transactions after the account write lock.
- Added `409 Conflict` with a Spanish domain message.
- Added `collectibleToday` DTO parsing and a pre-pagination `NOT EXISTS` payment filter.
- Preserved status, zone, soft-delete, overpayment, balance, and response-shape behavior.

### Mobile

- Added `collectibleToday` to the pagination contract and Axios request params.
- Enabled it in `ActiveCreditsList` and `fetchActiveCredits`, including post-payment and post-delete refreshes.
- Refactored `getCreditsService` away from query-string concatenation to a typed `params` object.
- Configured `paramsSerializer: { indexes: null }` so status arrays remain `status=active&status=overdue` for Nest.
- Removed the previous accidental newline/whitespace from the account request URL.

### Web

- Added repeated status serialization to account requests through Axios request params.
- Configured `paramsSerializer: { indexes: null }` so statuses remain repeated `status` keys for Nest.
- Made the shared account store always request `active`, `overdue`, and `cancelled`.
- Left `CustomerCreditsModal` unchanged so finished-credit history remains available.

## Files changed

### API

- `src/payment/payment.service.ts`
- `src/account/account.service.ts`
- `src/account/dto/paginate-account.dto.ts`
- `test/payment/payment.service.spec.ts`
- `test/account/account.service.spec.ts`
- `test/account/paginate-account.dto.spec.ts`
- `openspec/changes/enforce-one-payment-per-account-day/**`

### Mobile

- `Credit/components/ActiveCreditsList.tsx`
- `Credit/services/getCreditsService.ts`
- `Credit/services/__tests__/getCreditsService.test.ts`
- `Credit/store/index.ts`
- `interfaces/pagination.interface.ts`

### Web

- `src/services/account.service.ts`
- `src/store/useAccountStore.ts`

## TDD cycle evidence

| Work unit | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- |
| API daily payment invariant | `payment.service.spec.ts`: 5 new tests failed because duplicate lookup did not exist | Focused payment suite passed after transactional `EntityManager.exists` assertion | Added adjacent Lima-day range case; full payment suite remained green | Extracted `assertPaymentDayAvailable`, centralized Lima timezone, reused for create/update |
| API account eligibility | DTO/service tests failed because `collectibleToday` was rejected/ignored | DTO parsing and `NOT EXISTS` query made focused tests pass | Combined with existing admin/lender zone and pagination tests; full account suite passed | Kept optional filter in existing query pipeline before order/skip/take |
| Mobile query contract | 2 service tests failed because the flag was absent and URL contained trailing whitespace | Service serialized optional flag and tests passed | Full mobile Jest suite passed; both list and refresh paths use the flag | Replaced manual query fragments with typed Axios `params`; `indexes: null` preserves repeated status keys |
| Mobile Axios params refactor | Updated service expectations failed against the prior URL-string call | Axios request config made focused tests pass 2/2 | Full mobile Jest suite remained green at 14/14 | Optional params are added conditionally; no template-string concatenation remains |
| Web visibility | No dedicated web test runner exists | TypeScript/Vite production build passed with repeated status serialization | Shared store action covers initial, zone, page, limit, and mutation refresh paths | Kept status selection in one data-loading path rather than component filtering |

## Commands and evidence

### API

| Command | Result |
| --- | --- |
| `yarn test payment/payment.service.spec.ts --runInBand` before implementation | RED: 5 expected failures, 34 existing tests passed |
| `yarn test account/account.service.spec.ts account/paginate-account.dto.spec.ts --runInBand` before implementation | RED: 3 expected failures |
| Focused payment/account/DTO suite after implementation | PASS: 76/76 |
| Strict boolean decorator/customer/account DTO suite | RED: missing decorator plus 2 customer coercion failures; GREEN: 17/17 |
| `yarn test --runInBand` final after refactor | PASS: 28 suites, 292 tests |
| `yarn build` | PASS |
| Changed-file ESLint | PASS |
| `yarn test:e2e --runInBand` | BLOCKED by pre-existing `supertest` namespace import compile error in `test/app.e2e-spec.ts:19` |
| Full ESLint without `--fix` | BLOCKED by 76 repository-baseline errors; changed production files introduce no changed-file lint errors |

### Mobile

| Command | Result |
| --- | --- |
| Focused service test before implementation | RED: 2 expected URL assertions failed |
| Focused service test after implementation | PASS: 2/2 |
| `npx jest --runInBand` final | PASS: 2 suites, 14 tests |
| Changed-file ESLint | PASS with 6 pre-existing warnings, zero errors |
| `npx tsc --noEmit` | BLOCKED by missing template imports in `components/Collapsible.tsx` and `components/HelloWave.tsx` |
| `npm run lint` | BLOCKED by 16 repository-baseline errors and 49 warnings outside this change |

### Web

| Command | Result |
| --- | --- |
| `npm run build` | PASS |
| `npm run lint` | BLOCKED before file analysis because `.eslintrc.cjs` configures invalid rule `endOfLine: "auto"` |

### Repository integrity

- `git diff --check`: pass in API, mobile, and web (API emits only the existing LF/CRLF conversion warning).
- No commits created. Repository heads remain:
  - API `0061b7e`
  - Mobile `049b4db`
  - Web `39e8067`
- Initial command incidents using the container root and Windows `cd /d` were not counted as RED evidence; commands were rerun from explicit Git roots.

## Review workload

| Category | Added lines |
| --- | ---: |
| API/mobile/web original implementation and tests | 365 |
| Strict boolean parser refactor and tests | 119 |
| Current functional implementation total | 484 |
| OpenSpec planning artifacts before apply/verify reports | 644 |
| 400-line budget result | Exceeded after the explicitly requested follow-up refactor; split delivery is required |
| Total review surface | Above 400 when SDD artifacts are included |

Future commits should remain split by repository/work unit after user testing. No commit action is authorized yet.

## Deviations and fallback

- The Pi session did not expose `subagent_run` or a native `Agent` tool. SDD phases were executed sequentially by the parent using the same artifact, strict-TDD, status, and verification contracts.
- No database unique index was added, matching the design decision to avoid deployment failure on unaudited legacy duplicates.
- No baseline lint/e2e/typecheck issue was modified because doing so would expand scope.

## Follow-up web Axios params refactor

The web account service now passes a typed `AccountQueryParams` object to Axios instead of concatenating status and zone query strings. `paramsSerializer: { indexes: null }` preserves repeated `status` keys. The production build and diff check pass; global lint remains blocked by the pre-existing invalid ESLint configuration.

## Follow-up mobile Axios params refactor

The mobile credit service now passes a typed `params` object to Axios instead of manually concatenating a URL. `paramsSerializer: { indexes: null }` preserves the backend contract for repeated account statuses. Focused tests passed 2/2, the full mobile suite passed 14/14, and changed-file lint/diff checks passed.

## Follow-up strict boolean refactor

After the initial implementation, the user explicitly requested centralizing boolean query parsing.

- Added `src/common/decorators/to-boolean.decorator.ts`.
- Proved RED that the previous customer `@Type(() => Boolean)` converted `all=false` to `true` and accepted `all=1` as true.
- Replaced both the inline account transform and customer boolean coercion with `@ToBoolean()`.
- Unsupported values remain unchanged so `@IsBoolean()` rejects them.
- Focused suite: 17/17 pass.
- Final API suite after refactor: 28 suites, 292 tests pass.
- API build and changed-file lint pass.

## Remaining work

- User manual acceptance testing.
- Decide separately whether to repair baseline API e2e, mobile type/lint, and web ESLint configuration.
- Do not sync/archive this change as fully verified while the configured e2e gate is blocked.

## Consumed action context

- mode: workspace-planning with explicit edit scope
- workspace root: `E:/work/payments_app`
- allowed edit roots: API source/tests/OpenSpec, mobile source/tests, web source
- repositories written sequentially
- commit authorization: none

## Phase result

- status: success
- executive_summary: implementation complete; focused/full behavior tests and builds pass
- next_recommended: verify-report
- risks: baseline gates block fully passing SDD verification; total docs-inclusive review surface exceeds 400 lines
- skill_resolution: none; parent fallback used because no subagent runtime was exposed
