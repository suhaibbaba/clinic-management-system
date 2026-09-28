import { doctorTimeOff } from "@api/database/schema";

export type TimeOffRow = typeof doctorTimeOff.$inferSelect;
