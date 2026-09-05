/**
 * Container healthcheck for the API. Exits 0 only when /health reports that the
 * database is reachable, so an API that lost Postgres is marked unhealthy.
 * Uses Node's global fetch — no curl/wget needed in the runtime image.
 */
const port = process.env.PORT ?? '3000';

fetch(`http://127.0.0.1:${port}/health`)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((body) => {
    if (body.status !== 'ok') {
      throw new Error(`status=${body.status} database=${body.database}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error(`healthcheck failed: ${error.message}`);
    process.exit(1);
  });
