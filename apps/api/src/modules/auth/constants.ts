export const INVALID_CREDENTIALS = "Invalid credentials";

export const PHONE_MIN_DIGITS = 7;

export const LOGIN_MAX_FAILURES = 5;

export const LOGIN_WINDOW_MINUTES = 15;

export const LOGIN_LOCK_MINUTES = 15;

export const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const REFRESH_TOKEN_BYTES = 32;

export const SESSION_REFRESH_TTL_HOURS = 12;

export const LOGIN_CODE_TTL_MINUTES = 10;

export const LOGIN_CODE_MAX_ATTEMPTS = 5;

export const LOGIN_CODE_RESEND_SECONDS = 60;

export const LOGIN_CODE_SENDS_PER_HOUR = 5;

export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"] as const;

export const GOOGLE_STATE_COOKIE = "clinic_google_oauth";

export const GOOGLE_STATE_TTL_SECONDS = 600;

export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";

export const GOOGLE_TOKEN_TIMEOUT_MS = 10_000;

export const AUTH_CHALLENGE_TTL_MINUTES = 5;

export const AUTH_CHALLENGE_PURPOSE = {
  PASSKEY_LOGIN: "passkey_login",
  PASSKEY_REGISTER: "passkey_register",
} as const;

export const PASSKEYS_PER_USER = 20;
