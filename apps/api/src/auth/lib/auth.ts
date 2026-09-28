import { users } from "@api/database/schema";

export type UserRow = typeof users.$inferSelect;
