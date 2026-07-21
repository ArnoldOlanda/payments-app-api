# Sync Report — fix-account-update-remaining-balance

**status:** synced
**change:** `fix-account-update-remaining-balance`
**artifact_store:** `openspec`
**date:** 2026-07-21

## Domains synced

| Domain | Operation | Canonical file |
|---|---|---|
| `account` | new (copy from change spec) | `openspec/specs/account/spec.md` |

## ADDED / MODIFIED / REMOVED Requirements

This change introduced a **new canonical spec** for the `account` domain (no canonical existed before). All 15 requirements from the change spec were copied verbatim into the canonical path:

### Requirement: Account Creation
### Requirement: Account Retrieval by ID
### Requirement: Account Listing with Pagination and Zone-Scope
### Requirement: Account Update — Only Amount and Due Date Are Mutable
### Requirement: Account Update — Recompute Remaining Balance from Payments
### Requirement: Account Update — Reject Amount Below Sum of Payments
### Requirement: Account Update — Reactivate Finished Accounts
### Requirement: Account Update — Due Date Validation Against Stored Date
### Requirement: Account Update — Transactional with Row Lock
### Requirement: Account Update — Access Control and Cache Invalidation
### Requirement: Account Deletion — Soft Delete with Cascade
### Requirement: Account Status — Automatic Transitions from Mutations
### Requirement: Account Cron — Overdue Marking
### Requirement: Account Access Control — Zone-Scope
### Requirement: Account Cache — Key Invalidation Discipline

No MODIFIED or REMOVED operations: there was no pre-existing canonical to mutate.

## Active same-domain collisions

None. This is the only active change touching `openspec/changes/*/specs/account/spec.md`.

## Legacy flat spec warning

None. The change spec lives under `openspec/changes/{change}/specs/account/spec.md`, not the legacy flat path.

## Destructive sync approvals

Not applicable — new canonical, no destruction.

## Validation commands performed

- `yarn test --no-coverage` → 144/144 passing.
- `yarn lint` → clean for files modified by this change.
- `verify-report.md` → present, status `passing`.

## Status / ActionContext

- `actionContext.mode`: workspace-planning (assumed; no explicit override)
- `allowedEditRoots`: `openspec/` (parent prompt inferred)
- Canonical path `openspec/specs/account/spec.md` is within workspace.

## Next recommended phase

`sdd-archive`. All preconditions satisfied:

- `verify-report.md` present and passing.
- No unchecked implementation tasks in `tasks.md` (gate passes; see archive).
- Canonical spec promoted.