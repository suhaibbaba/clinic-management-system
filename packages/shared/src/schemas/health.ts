import { z } from 'zod';

export const healthStatusSchema = z.enum(['ok', 'degraded']);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  database: z.enum(['up', 'down']),
  version: z.string().min(1),
  /** ISO-8601, Gregorian — CLAUDE.md: Gregorian dates everywhere. */
  timestamp: z.iso.datetime(),
  uptimeSeconds: z.number().nonnegative(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

// Its own endpoint: a healthcheck polls `/health` every fifteen seconds and wants the database
// probe; a settings screen wants one string.
export const versionResponseSchema = z.object({
  /** `<major>.<minor>.<commit count>` — see `scripts/app-version.mjs`. */
  version: z.string().min(1),
});

export type VersionResponse = z.infer<typeof versionResponseSchema>;
