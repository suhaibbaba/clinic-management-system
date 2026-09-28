import { z } from "zod";

export const rejectBookingSchema = z.object({ reason: z.string().trim().min(3).max(300) });
