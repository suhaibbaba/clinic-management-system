import { and, eq, isNull } from "drizzle-orm";
import type { UserRole } from "@clinic/shared";
import { type Database } from "@api/database/database.module";
import { users } from "@api/database/schema";

export interface SessionState {
  readonly clinicId: string;
  readonly role: UserRole;
  readonly isActive: boolean;
}

const FRESH_FOR_MS = 30_000;

const cache = new Map<string, { readonly state: SessionState | null; readonly at: number }>();

export async function sessionState(db: Database, userId: string): Promise<SessionState | null> {
  const cached = cache.get(userId);

  if (cached && Date.now() - cached.at < FRESH_FOR_MS) {
    return cached.state;
  }

  const [row] = await db
    .select({ clinicId: users.clinicId, role: users.role, isActive: users.isActive })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  const state = row ?? null;
  cache.set(userId, { state, at: Date.now() });

  return state;
}

export function forgetSessionState(userId: string): void {
  cache.delete(userId);
}
