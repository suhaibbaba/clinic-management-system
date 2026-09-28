import { z } from "zod";

export const healthStatusSchema = z.enum(["ok", "degraded"]);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  database: z.enum(["up", "down"]),
  version: z.string().min(1),
  timestamp: z.iso.datetime(),
  uptimeSeconds: z.number().nonnegative(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const versionResponseSchema = z.object({
  version: z.string().min(1),
});

export type VersionResponse = z.infer<typeof versionResponseSchema>;
