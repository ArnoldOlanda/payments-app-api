# Mobile active-credit visibility

## Requirements

### Requirement: Mobile active credits show only accounts collectible today

The mobile active-credit view MUST request accounts with statuses `active` and `overdue` and MUST enable the API's `collectibleToday` filter.

#### Scenario: Hide an active account after a partial payment

- GIVEN an active account receives its first payment during the current Lima day
- AND the account retains a positive balance
- WHEN mobile refreshes the active-credit view
- THEN the account is absent from the view for the remainder of that Lima day

#### Scenario: Hide an overdue account after payment

- GIVEN an overdue account receives its first payment during the current Lima day
- AND it remains overdue with a positive balance
- WHEN mobile refreshes the active-credit view
- THEN the account is absent from the view for the remainder of that Lima day

#### Scenario: Show the account again after deleting today's payment

- GIVEN today's only payment for an otherwise eligible account is soft-deleted
- WHEN mobile refreshes the active-credit view
- THEN the account can appear again

#### Scenario: Keep other credit views unchanged

- GIVEN the user opens all credits, credit details, or customer credit history
- WHEN those views load
- THEN this change does not automatically apply `collectibleToday` to those requests

### Requirement: Mobile relies on server-side eligibility

Mobile MUST NOT remove paid-today accounts from an already paginated client-side page. It MUST serialize `collectibleToday=true` in the active-credit API request so API pagination metadata remains authoritative.
