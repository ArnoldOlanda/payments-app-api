# Analytics Specification — Delta: Timezone-Aware Ranges

This delta makes analytics range computation timezone-aware. Original analytics spec (if any) is not modified; this file declares net-new requirements.

## Requirements

### Requirement: Range computation uses the actor's timezone

The system MUST compute "today" and any other date range in the timezone of the authenticated actor, not the container's timezone.

#### Scenario: User in Tokyo gets JST-aligned "today"

- GIVEN an actor with `timezone = 'Asia/Tokyo'`
- AND the current UTC time is `2025-06-15T15:00:00Z` (which is `2025-06-16T00:00 JST`)
- WHEN `GET /analytics/kpis` is called by that actor
- THEN `dayStart` for "today" is `2025-06-15T15:00:00Z` (start of JST day 16)
- AND `dayEnd` for "today" is `2025-06-16T15:00:00Z` (end of JST day 16)

#### Scenario: User in Buenos Aires gets ART-aligned "today"

- GIVEN an actor with `timezone = 'America/Argentina/Buenos_Aires'`
- AND the current UTC time is `2025-06-16T02:00:00Z` (which is `2025-06-15T23:00 ART`)
- WHEN `GET /analytics/kpis` is called
- THEN "today" for that actor refers to `2025-06-15` in ART
- AND `dayStart` is `2025-06-15T03:00:00Z` (00:00 ART)

#### Scenario: Legacy user with UTC stays unchanged

- GIVEN an actor with `timezone = 'UTC'` (default for legacy users post-migration)
- WHEN `GET /analytics/kpis` is called
- THEN the range boundaries match today's behavior (UTC-aligned)
