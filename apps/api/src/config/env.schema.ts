import { z } from 'zod';

/**
 * Single source of truth for process environment. Every variable the API reads
 * is declared here and documented in the repository-root `.env.example`.
 * The app refuses to boot on an invalid environment rather than failing later.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Bind address. 0.0.0.0 so the container is reachable from the Docker network. */
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),

  /** postgres://user:password@host:port/database */
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\/.+/, 'DATABASE_URL must be a postgres:// connection string'),

  /** Keep the pool small — target infra is a single cheap VPS. */
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),

  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose']).default('log'),

  /**
   * Signing key for access tokens. Must be replaced per environment — the value
   * in .env.example is a development placeholder, not a secret.
   */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** Access tokens are short-lived; the refresh token carries the session. */
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),

  /**
   * Path the refresh-token cookie is scoped to, as the *browser* sees it. The
   * web app reaches the API through a same-origin `/api` proxy, so the default
   * covers every deployment without coupling the API to the proxy prefix.
   */
  AUTH_COOKIE_PATH: z.string().min(1).default('/'),

  /* ---------------------------- Object storage --------------------------- */

  /**
   * S3-compatible endpoint. Cloudflare R2 in production, MinIO in the dev
   * stack — the API only ever speaks the S3 API, so nothing needs real R2
   * credentials to run locally.
   */
  STORAGE_ENDPOINT: z.string().regex(/^https?:\/\/.+/, 'STORAGE_ENDPOINT must be a URL'),
  /** R2 ignores the region but the SDK requires one; `auto` is R2's convention. */
  STORAGE_REGION: z.string().min(1).default('auto'),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  /** MinIO needs path-style addressing; R2 does not. */
  STORAGE_FORCE_PATH_STYLE: z.stringbool().default(false),
  /** Presigned upload URLs are single-use in practice and short-lived. */
  STORAGE_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),
  /** Medical images are never public; every read is a fresh short-lived URL. */
  STORAGE_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),

  /** Password given to every account created by `pnpm seed`. Development only. */
  SEED_PASSWORD: z.string().min(8).default('ChangeMe123!'),

  /** Reported by /health so a running build can be identified. */
  APP_VERSION: z.string().min(1).default('0.1.0'),

  /* ---------------------------- Notifications --------------------------- */

  /**
   * Which provider actually sends.
   *
   * `log` is the default everywhere, sandbox included: it writes the message to
   * `notifications_log` and to the application log and sends nothing. That is
   * what makes this module runnable with no credentials at all, and it is the
   * behaviour every test relies on.
   *
   * `http` posts to `NOTIFICATIONS_HTTP_URL`, which is generic enough for a
   * local SMS gateway or the WhatsApp Business API. Neither is integrated here.
   */
  NOTIFICATIONS_PROVIDER: z.enum(['log', 'http']).default('log'),
  NOTIFICATIONS_HTTP_URL: z.string().url().optional(),
  /** Sent as `Authorization: Bearer …` when present. */
  NOTIFICATIONS_HTTP_TOKEN: z.string().optional(),
  NOTIFICATIONS_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),

  /* ------------------------------- Booking ------------------------------ */

  /**
   * Signs the opaque booking tokens in a manage link.
   *
   * Separate from `JWT_SECRET` on purpose: a booking token is handed to an
   * anonymous stranger over SMS and lives for weeks, where an access token is
   * short-lived and belongs to a signed-in member of staff. One key compromised
   * must not be the other. Falls back to `JWT_SECRET` only so a development
   * environment boots without a second variable.
   */
  BOOKING_TOKEN_SECRET: z.string().min(32).optional(),

  /** Public origin the manage link points at, e.g. https://clinic.example. */
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * `validate` hook for `ConfigModule.forRoot`. Throws a readable, aggregated
 * error listing every offending variable.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return result.data;
}
