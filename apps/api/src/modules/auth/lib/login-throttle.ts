import { createHash } from "node:crypto";

export function loginThrottleKey(identifier: string, clinicId: string | null): string {
  const value = identifier.trim().toLowerCase();
  const digits = value.replace(/\D/g, "");
  const subject = value.includes("@") || digits.length < 7 ? value : digits.slice(-9);

  return createHash("sha256")
    .update(`login:${clinicId ?? "*"}:${subject}`)
    .digest("hex");
}
