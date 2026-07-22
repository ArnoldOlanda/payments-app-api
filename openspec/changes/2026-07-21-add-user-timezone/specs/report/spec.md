# Report Specification — Delta: Timezone-Aware Ranges and PDF Display

This delta makes report range computation and PDF date display timezone-aware. Original report spec (if any) is not modified; this file declares net-new requirements.

## Requirements

### Requirement: Weekly range starts Monday in the actor's locale

The system MUST compute the current week (Monday-anchored) using the actor's timezone.

#### Scenario: User in Buenos Aires gets Monday-aligned week

- GIVEN an actor with `timezone = 'America/Argentina/Buenos_Aires'`
- WHEN `getDaysWeek` runs
- THEN it returns 7 dates starting on the Monday of the actor's current week (per ART)

#### Scenario: User in Tokyo gets Monday-aligned week

- GIVEN an actor with `timezone = 'Asia/Tokyo'`
- WHEN `getDaysWeek` runs
- THEN it returns 7 dates starting on the Monday of the actor's current week (per JST)

### Requirement: PDF reports format dates in the actor's timezone

The system MUST format dates inside `getFichaPagos` PDFs using the actor's timezone, via the centralized `tempo` wrapper.

#### Scenario: PDF date formatted in actor's TZ

- GIVEN an actor with `timezone = 'America/Argentina/Buenos_Aires'`
- WHEN `getFichaPagos` is called
- THEN every date rendered in the PDF reflects ART (UTC-3), not the container TZ
