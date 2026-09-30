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

export const LOGIN_CODE_TTL_MINUTES = 10;

export const LOGIN_CODE_MAX_ATTEMPTS = 5;

export const LOGIN_CODE_RESEND_SECONDS = 60;

export const LOGIN_CODE_SENDS_PER_HOUR = 5;
