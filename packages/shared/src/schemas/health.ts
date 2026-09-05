import { z } from 'zod';

/**
 * Sample schema proving the shared-package wiring: the API validates its
 * `/health` response with it, the web app parses the fetched payload with it,
 * and both sides share the inferred type. No duplicated validation anywhere.
 */
export const healthStatusSchema = z.enum(['ok', 'degraded']);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  /** Result of the database connectivity probe. */
  database: z.enum(['up', 'down']),
  /** API package version, so a deployed build can be identified. */
  version: z.string().min(1),
  /** ISO-8601, Gregorian — CLAUDE.md: Gregorian dates everywhere. */
  timestamp: z.iso.datetime(),
  /** Probe round-trip in milliseconds. */
  uptimeSeconds: z.number().nonnegative(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
