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

  /** Reported by /health so a running build can be identified. */
  APP_VERSION: z.string().min(1).default('0.1.0'),
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
