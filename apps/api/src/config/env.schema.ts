import { z } from "zod";

// Every variable the API reads is declared here and documented in `.env.example`. The app refuses
// to boot on an invalid environment rather than failing later.
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Bind address. 0.0.0.0 so the container is reachable from the Docker network. */
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),

  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\/.+/, "DATABASE_URL must be a postgres:// connection string"),

  /** Keep the pool small — target infra is a single cheap VPS. */
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),

  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "log", "debug", "verbose"]).default("log"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  /** Access tokens are short-lived; the refresh token carries the session. */
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),

  // The path as the browser sees it: the app reaches the API through a same-origin `/api` proxy, so
  // anything narrower must cover `/api/auth/refresh`, not `/auth/refresh`.
  AUTH_COOKIE_PATH: z
    .string()
    .min(1)
    .startsWith("/", "AUTH_COOKIE_PATH must start with /")
    .default("/"),

  // `auto` is production plus the browser's own scheme (from `X-Forwarded-Proto`), so it can only
  // ever add `Secure`: a forged header must not talk a real deployment out of it.
  AUTH_COOKIE_SECURE: z.enum(["auto", "always", "never"]).default("auto"),

  // `none` is for a cross-origin frontend and browsers only accept it with `Secure`, so it implies
  // it — asking for `never` too gets `lax` back rather than a cookie nothing will store.
  AUTH_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),

  STORAGE_ENDPOINT: z.string().regex(/^https?:\/\/.+/, "STORAGE_ENDPOINT must be a URL"),
  /** R2 ignores the region but the SDK requires one; `auto` is R2's convention. */
  STORAGE_REGION: z.string().min(1).default("auto"),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  /** MinIO needs path-style addressing; R2 does not. */
  STORAGE_FORCE_PATH_STYLE: z.stringbool().default(false),
  STORAGE_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),
  /** Medical images are never public; every read is a fresh short-lived URL. */
  STORAGE_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),
  STORAGE_BRANDING_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(604_800)
    .default(604_800),
  /** How often the branding URL changes. Shorter than the TTL, or a handed-out URL could expire. */
  STORAGE_BRANDING_URL_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(604_800)
    .default(86_400),

  /** Password given to every account created by `pnpm seed`. Development only. */
  SEED_PASSWORD: z.string().min(8).default("ChangeMe123!"),

  // From the environment because `.git` is not in the Docker build context. The default marks a
  // build that was never deployed, which is the honest answer.
  APP_VERSION: z.string().min(1).default("0.0.0-dev"),

  // `log` is the default everywhere, sandbox included: it records the message and sends nothing,
  // which is what every test relies on.
  NOTIFICATIONS_PROVIDER: z.enum(["log", "http"]).default("log"),
  NOTIFICATIONS_HTTP_URL: z.string().url().optional(),
  NOTIFICATIONS_HTTP_TOKEN: z.string().optional(),
  NOTIFICATIONS_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),

  // Separate from `JWT_SECRET`: this one goes to a stranger over SMS and lives for weeks. It falls
  // back to it only so development boots without a second variable.
  BOOKING_TOKEN_SECRET: z.string().min(32).optional(),

  // `log` again by default, for the same reason: the activation link is written to the log, so the
  // whole flow works end to end on a machine with no mail account at all.
  EMAIL_PROVIDER: z.enum(["log", "resend"]).default("log"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Clinic <onboarding@resend.dev>"),
  EMAIL_LINK_TTL_HOURS: z.coerce.number().int().min(1).max(336).default(48),

  PUBLIC_BASE_URL: z.string().url().default("http://localhost:5173"),

  // `log` answers with a fixed line and calls nobody, so the assistant boots and its tests run on a
  // machine with no account at all — the same shape as the notification and email providers.
  AI_PROVIDER: z.enum(["log", "openai"]).default("log"),
  OPENAI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().min(1).default("gpt-4o-mini"),
  /** Ceiling on one answer. A question wants a paragraph, not an essay. */
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(4_096).default(800),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  /** How many past messages the model is shown. Older ones are dropped, never sent. */
  AI_HISTORY_MESSAGES: z.coerce.number().int().min(2).max(100).default(20),
  /** How many tool rounds one question may take before the loop gives up. */
  AI_MAX_TOOL_STEPS: z.coerce.number().int().min(1).max(10).default(5),
  AI_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(1_000).default(30),
  /** Tokens a whole clinic may spend in its own day, across every user. */
  AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().min(1_000).default(200_000),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return result.data;
}
