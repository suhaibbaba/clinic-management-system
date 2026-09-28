import { type users } from "@api/database/schema";

export type UserRow = typeof users.$inferSelect;

export interface IssuedRefreshToken {
  readonly id: string;
  readonly token: string;
}
