# Auth Specification — Delta: Timezone Capture

This delta adds the `X-Timezone` header capture, the JWT `timezone` claim, and the `timezone` field on the validated `Actor`.

## Requirements

### Requirement: Authentication captures client timezone via header

The system MUST read the `X-Timezone` request header on any authenticated request, validate it as IANA, and persist it lazily on the user row.

#### Scenario: Valid header on login persists

- GIVEN a user authenticates via `POST /auth/login` with header `X-Timezone: America/Argentina/Buenos_Aires`
- WHEN the login succeeds
- THEN the user row has `timezone = 'America/Argentina/Buenos_Aires'`
- AND the issued JWT contains `timezone: 'America/Argentina/Buenos_Aires'`

#### Scenario: Invalid header is rejected

- GIVEN a user authenticates via `POST /auth/login` with header `X-Timezone: Mars/Olympus_Mons`
- WHEN the request reaches the auth pipeline
- THEN the response is `400 Bad Request`
- AND no row write occurs

#### Scenario: Absent header does not touch the row

- GIVEN a user with stored `timezone = 'Europe/Madrid'` authenticates via `POST /auth/login` without an `X-Timezone` header
- WHEN the login succeeds
- THEN the user row's `timezone` is unchanged
- AND the issued JWT contains `timezone: 'Europe/Madrid'` (the stored value)

#### Scenario: Header equal to stored value is a no-op

- GIVEN a user with stored `timezone = 'Europe/Madrid'`
- WHEN an authenticated request arrives with header `X-Timezone: Europe/Madrid`
- THEN no `UPDATE` is issued against the user row
- AND the request continues normally

### Requirement: JWT carries timezone claim

The system MUST include `timezone` in every issued JWT payload, equal to the user's stored value at the time of issuance.

#### Scenario: Claim present on login

- GIVEN a user with `timezone = 'Asia/Tokyo'`
- WHEN the user logs in
- THEN the JWT payload contains `timezone: 'Asia/Tokyo'`

### Requirement: Actor exposes timezone

The system MUST surface the JWT's `timezone` claim as a property on the validated `Actor`.

#### Scenario: JwtStrategy.validate returns Actor with timezone

- GIVEN a JWT with `timezone: 'Europe/Madrid'`
- WHEN `JwtStrategy.validate` runs
- THEN the returned actor has `timezone === 'Europe/Madrid'`

### Requirement: `@CurrentTimezone` decorator extracts the actor's timezone

The system MUST provide a `@CurrentTimezone()` parameter decorator that returns `req.user.timezone`.

#### Scenario: Decorator on a controller param

- GIVEN a controller method declared as `@Get('foo') foo(@CurrentTimezone() tz: string)`
- WHEN the request is authenticated
- THEN `tz` equals the actor's stored timezone
