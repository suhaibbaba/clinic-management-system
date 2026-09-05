/**
 * Test-run defaults. The database URL must be provided by the environment
 * (docker compose locally, a service container in CI) — tests run against a
 * real Postgres so clinic scoping and audit writes are exercised for real.
 */
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] ??= 'test-only-jwt-secret-value-at-least-32-chars';
process.env['LOG_LEVEL'] ??= 'error';
