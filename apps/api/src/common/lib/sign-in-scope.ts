import { eq, type SQL } from "drizzle-orm";
import { users } from "@api/database/schema";

export const inSignInClinic = (clinicId: string | null): SQL | undefined =>
  clinicId === null ? undefined : eq(users.clinicId, clinicId);

export const onlyMatch = <T>(rows: readonly T[]): T | undefined =>
  rows.length === 1 ? rows[0] : undefined;
