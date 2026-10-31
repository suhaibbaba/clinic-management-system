import { createHash } from "node:crypto";

export const hashCode = (code: string): string => createHash("sha256").update(code).digest("hex");
