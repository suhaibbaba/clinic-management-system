import { describe, expect, it } from "vitest";
import { type VendorClinicKeys } from "@clinic/shared";
import { initialKeysDraft, keysChanges, keysValid } from "@web/vendor/lib/keys";

const saved: VendorClinicKeys = {
  encryptionAvailable: true,
  emailFrom: "Clinic <no-reply@clinic.ps>",
  resendApiKeyHint: "a1b2",
  googleClientId: "1234567890.apps.googleusercontent.com",
  googleClientSecretHint: null,
};

describe("a clinic's email and Google keys", () => {
  it("sends nothing while nothing is typed", () => {
    expect(keysChanges(saved, initialKeysDraft(saved))).toEqual({});
  });

  it("never prefills a secret, so the form cannot echo one back", () => {
    expect(initialKeysDraft(saved)).toEqual({
      emailFrom: "Clinic <no-reply@clinic.ps>",
      resendApiKey: "",
      googleClientId: "1234567890.apps.googleusercontent.com",
      googleClientSecret: "",
    });
  });

  it("sends a typed secret, trimmed", () => {
    const draft = { ...initialKeysDraft(saved), googleClientSecret: "  GOCSPX-secret-value " };

    expect(keysChanges(saved, draft)).toEqual({ googleClientSecret: "GOCSPX-secret-value" });
  });

  it("clears a plain value emptied in the form", () => {
    const draft = { ...initialKeysDraft(saved), emailFrom: "   " };

    expect(keysChanges(saved, draft)).toEqual({ emailFrom: null });
  });

  it("refuses a secret too short to be real", () => {
    expect(
      keysValid(keysChanges(saved, { ...initialKeysDraft(saved), resendApiKey: "re_1" })),
    ).toBe(false);
  });
});
