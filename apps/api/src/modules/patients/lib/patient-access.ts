import { patients } from "@api/database/schema";

export type PatientRow = typeof patients.$inferSelect;
