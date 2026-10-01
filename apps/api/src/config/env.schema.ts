import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),

  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\/.+/, "DATABASE_URL must be a postgres:// connection string"),

  MIGRATION_DATABASE_URL: z
    .string()
    .regex(
      /^postgres(ql)?:\/\/.+/,
      "MIGRATION_DATABASE_URL must be a postgres:// connection string",
    )
    .optional(),
  APP_DATABASE_ROLE: z
    .string()
    .regex(/^[a-z_][a-z0-9_]{0,62}$/, "APP_DATABASE_ROLE must be a plain lowercase role name")
    .optional(),
  APP_DATABASE_PASSWORD: z
    .string()
    .min(16, "APP_DATABASE_PASSWORD must be at least 16 characters")
    .optional(),

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

  TRUST_PROXY: z.string().min(1).default("loopback, linklocal, uniquelocal"),

  THROTTLE_ENABLED: z.stringbool().optional(),
  THROTTLE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().max(100_000).default(600),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "log", "debug", "verbose"]).default("log"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),

  AUTH_COOKIE_PATH: z
    .string()
    .min(1)
    .startsWith("/", "AUTH_COOKIE_PATH must start with /")
    .default("/"),

  AUTH_COOKIE_SECURE: z.enum(["auto", "always", "never"]).default("auto"),

  AUTH_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),

  STORAGE_ENDPOINT: z.string().regex(/^https?:\/\/.+/, "STORAGE_ENDPOINT must be a URL"),
  STORAGE_REGION: z.string().min(1).default("auto"),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_FORCE_PATH_STYLE: z.stringbool().default(false),
  STORAGE_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),
  STORAGE_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),
  STORAGE_BRANDING_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(604_800)
    .default(604_800),
  STORAGE_BRANDING_URL_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(604_800)
    .default(86_400),

  SEED_PASSWORD: z.string().min(8).default("ChangeMe123!"),

  APP_VERSION: z.string().min(1).default("0.0.0-dev"),

  NOTIFICATIONS_PROVIDER: z.enum(["log", "http", "whatsapp"]).default("log"),
  NOTIFICATIONS_HTTP_URL: z.string().url().optional(),
  NOTIFICATIONS_HTTP_TOKEN: z.string().optional(),
  NOTIFICATIONS_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_TEMPLATE_NAME: z.string().optional(),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().min(2).default("ar"),
  WHATSAPP_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default("v21.0"),

  BOOKING_TOKEN_SECRET: z.string().min(32).optional(),

  EMAIL_PROVIDER: z.enum(["log", "resend"]).default("log"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Clinic <onboarding@resend.dev>"),
  EMAIL_LINK_TTL_HOURS: z.coerce.number().int().min(1).max(336).default(48),

  PUBLIC_BASE_URL: z.string().url().default("http://localhost:5173"),

  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  WEBAUTHN_RP_ID: z.string().min(1).optional(),
  WEBAUTHN_ORIGIN: z
    .string()
    .optional()
    .transform((value) =>
      value
        ?.split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),

  AI_PROVIDER: z.enum(["log", "openai"]).default("log"),
  OPENAI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().min(1).default("gpt-5.6-luna"),
  AI_REASONING_EFFORT: z
    .enum(["none", "low", "medium"])
    .default("none")
    .refine((value) => value === "none", {
      message: "Only `none` works with tools on Chat Completions",
    }),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(4_096).default(800),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  AI_HISTORY_MESSAGES: z.coerce.number().int().min(2).max(100).default(60),
  AI_MAX_TOOL_STEPS: z.coerce.number().int().min(1).max(10).default(5),
  AI_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(1_000).default(30),
  AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().min(1_000).default(200_000),
  SECRETS_MASTER_KEY: z
    .string()
    .refine((value) => Buffer.from(value, "base64").length === 32, "Expected 32 bytes, base64")
    .optional(),
  AI_PROPOSAL_TTL_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  AI_AUTOMATION_HOUR: z.coerce.number().int().min(0).max(23).default(9),
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
