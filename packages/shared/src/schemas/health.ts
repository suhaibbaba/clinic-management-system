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

/**
 * `/version` — the deployed build, and nothing else.
 *
 * Its own endpoint beside `/health` because the two are asked by different
 * things for different reasons: a container healthcheck polls `/health` every
 * fifteen seconds and wants the database probe, while a settings screen wants
 * one string and should not be running a database probe to get it.
 */
export const versionResponseSchema = z.object({
  /** `<major>.<minor>.<commit count>` — see `scripts/app-version.mjs`. */
  version: z.string().min(1),
});

export type VersionResponse = z.infer<typeof versionResponseSchema>;
