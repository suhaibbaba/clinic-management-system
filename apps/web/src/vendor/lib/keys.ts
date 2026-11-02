import {
  saveClinicKeysSchema,
  type SaveClinicKeysInput,
  type VendorClinicKeys,
} from "@clinic/shared";

export interface KeysDraft {
  readonly emailFrom: string;
  readonly resendApiKey: string;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
}

export const initialKeysDraft = (keys: VendorClinicKeys): KeysDraft => ({
  emailFrom: keys.emailFrom ?? "",
  resendApiKey: "",
  googleClientId: keys.googleClientId ?? "",
  googleClientSecret: "",
});

export function keysChanges(keys: VendorClinicKeys, draft: KeysDraft): SaveClinicKeysInput {
  const plain = (typed: string, saved: string | null): string | null | undefined => {
    const value = typed.trim();

    return value === (saved ?? "") ? undefined : value === "" ? null : value;
  };
  const secret = (typed: string): string | undefined => typed.trim() || undefined;

  return Object.fromEntries(
    Object.entries({
      emailFrom: plain(draft.emailFrom, keys.emailFrom),
      resendApiKey: secret(draft.resendApiKey),
      googleClientId: plain(draft.googleClientId, keys.googleClientId),
      googleClientSecret: secret(draft.googleClientSecret),
    }).filter(([, value]) => value !== undefined),
  );
}

export const keysValid = (changes: SaveClinicKeysInput): boolean =>
  saveClinicKeysSchema.safeParse(changes).success;
