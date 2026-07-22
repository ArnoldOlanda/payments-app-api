# User Specification — Delta: User Timezone

This delta adds the `timezone` field to the user capability. The original user spec (if any) is not modified; this file declares net-new requirements.

## Requirements

### Requirement: User carries an IANA timezone

The system MUST persist a per-user IANA timezone identifier on the user row, defaulting to `'UTC'`.

#### Scenario: New user has UTC timezone

- GIVEN a new user is created via `POST /auth/register` or via seed
- WHEN the user row is persisted
- THEN `user.timezone === 'UTC'`

#### Scenario: Migration backfills UTC for existing users

- GIVEN the migration `AddUserTimezone` runs against a database with existing user rows
- WHEN the migration completes
- THEN every existing user row has `timezone = 'UTC'`

### Requirement: User can update their own timezone

The system MUST allow any authenticated user to update their own timezone via `PATCH /users/me/timezone`.

#### Scenario: Accept valid IANA identifier

- GIVEN an authenticated user with `timezone = 'UTC'`
- WHEN `PATCH /users/me/timezone` is called with `{ timezone: 'America/Argentina/Buenos_Aires' }`
- THEN the response is `200 OK` with body `{ timezone: 'America/Argentina/Buenos_Aires' }`
- AND the user row is updated
- AND no new JWT is issued (the change applies on the next login)

#### Scenario: Reject invalid identifier

- GIVEN any authenticated user
- WHEN `PATCH /users/me/timezone` is called with `{ timezone: 'Mars/Olympus_Mons' }`
- THEN the response is `400 Bad Request`
- AND the user row is not modified

#### Scenario: Reject identifier that is not IANA

- GIVEN any authenticated user
- WHEN `PATCH /users/me/timezone` is called with `{ timezone: 'UTC+3' }` (offset syntax)
- THEN the response is `400 Bad Request`

#### Scenario: Reject empty or oversize value

- GIVEN any authenticated user
- WHEN `PATCH /users/me/timezone` is called with `{ timezone: '' }` or any string longer than 64 chars
- THEN the response is `400 Bad Request`
