import { z } from 'zod';

// Every variable the API reads is declared here and documented in `.env.example`. The app refuses
// to boot on an invalid environment rather than failing later.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Bind address. 0.0.0.0 so the container is reachable from the Docker network. */
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),

  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\/.+/, 'DATABASE_URL must be a postgres:// connection string'),

  /** Keep the pool small — target infra is a single cheap VPS. */
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),

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

  // Must be replaced per environment — the value in .env.example is a development placeholder, not
  // a secret.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** Access tokens are short-lived; the refresh token carries the session. */
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),

  // The path as the browser sees it: the app reaches the API through a same-origin `/api` proxy, so
  // anything narrower must cover `/api/auth/refresh`, not `/auth/refresh`.
  AUTH_COOKIE_PATH: z
    .string()
    .min(1)
    .startsWith('/', 'AUTH_COOKIE_PATH must start with /')
    .default('/'),

  // `auto` is production plus the browser's own scheme (from `X-Forwarded-Proto`), so it can only
  // ever add `Secure`: a forged header must not talk a real deployment out of it.
  AUTH_COOKIE_SECURE: z.enum(['auto', 'always', 'never']).default('auto'),

  // `none` is for a cross-origin frontend and browsers only accept it with `Secure`, so it implies
  // it — asking for `never` too gets `lax` back rather than a cookie nothing will store.
  AUTH_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // Cloudflare R2 in production, MinIO in the dev stack — the API only speaks S3, so nothing needs
  // real R2 credentials locally.
  STORAGE_ENDPOINT: z.string().regex(/^https?:\/\/.+/, 'STORAGE_ENDPOINT must be a URL'),
  /** R2 ignores the region but the SDK requires one; `auto` is R2's convention. */
  STORAGE_REGION: z.string().min(1).default('auto'),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  /** MinIO needs path-style addressing; R2 does not. */
  STORAGE_FORCE_PATH_STYLE: z.stringbool().default(false),
  STORAGE_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),
  /** Medical images are never public; every read is a fresh short-lived URL. */
  STORAGE_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),

  /** Password given to every account created by `pnpm seed`. Development only. */
  SEED_PASSWORD: z.string().min(8).default('ChangeMe123!'),

  // From the environment because `.git` is not in the Docker build context. The default marks a
  // build that was never deployed, which is the honest answer.
  APP_VERSION: z.string().min(1).default('0.0.0-dev'),

  // `log` is the default everywhere, sandbox included: it records the message and sends nothing,
  // which is what every test relies on.
  NOTIFICATIONS_PROVIDER: z.enum(['log', 'http']).default('log'),
  NOTIFICATIONS_HTTP_URL: z.string().url().optional(),
  NOTIFICATIONS_HTTP_TOKEN: z.string().optional(),
  NOTIFICATIONS_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),

  // Separate from `JWT_SECRET`: this one goes to a stranger over SMS and lives for weeks. It falls
  // back to it only so development boots without a second variable.
  BOOKING_TOKEN_SECRET: z.string().min(32).optional(),

  PUBLIC_BASE_URL: z.string().url().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

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
