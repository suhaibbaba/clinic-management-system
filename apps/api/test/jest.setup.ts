/**
 * Test-run defaults. The database URL must be provided by the environment
 * (docker compose locally, a service container in CI) — tests run against a
 * real Postgres so clinic scoping and audit writes are exercised for real.
 */
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] ??= 'test-only-jwt-secret-value-at-least-32-chars';
process.env['LOG_LEVEL'] ??= 'error';

// Presigning is local computation, so the storage tests need credentials and an
// endpoint but no running bucket. The one call that does reach the network,
// HeadObject on confirm, is stubbed per suite.
process.env['STORAGE_ENDPOINT'] ??= 'http://localhost:9000';
process.env['STORAGE_BUCKET'] ??= 'clinic-test-files';
process.env['STORAGE_ACCESS_KEY_ID'] ??= 'test_access_key';
process.env['STORAGE_SECRET_ACCESS_KEY'] ??= 'test_secret_key';
process.env['STORAGE_FORCE_PATH_STYLE'] ??= 'true';
