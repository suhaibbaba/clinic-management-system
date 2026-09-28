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
