import { randomBytes } from "node:crypto";
import { redactKeys } from "@api/ai/openai-chat.provider";
import { open, seal, SecretUnreadableError } from "@api/secrets/secret-cipher";

const KEY = randomBytes(32);

describe("sealing a clinic's provider key", () => {
  it("opens with the key and the context it was sealed under", () => {
    const sealed = seal(KEY, "sk-live-abcdefghijklmnopqrstuvwxyz", "clinic-a:openai_api_key");

    expect(sealed.ciphertext).not.toContain("abcdefghijklmnop");
    expect(open(KEY, sealed, "clinic-a:openai_api_key")).toBe("sk-live-abcdefghijklmnopqrstuvwxyz");
  });

  // The clinic is authenticated data: a row copied into another clinic is unreadable there.
  it("refuses another clinic's context, a tampered value and another master key", () => {
    const sealed = seal(KEY, "a-whatsapp-token-value", "clinic-a:whatsapp_access_token");
    const flipped = Buffer.from(sealed.ciphertext, "base64");
    flipped[0] = (flipped[0] ?? 0) ^ 1;

    expect(() => open(KEY, sealed, "clinic-b:whatsapp_access_token")).toThrow(
      SecretUnreadableError,
    );
    expect(() =>
      open(
        KEY,
        { ...sealed, ciphertext: flipped.toString("base64") },
        "clinic-a:whatsapp_access_token",
      ),
    ).toThrow(SecretUnreadableError);
    expect(() => open(randomBytes(32), sealed, "clinic-a:whatsapp_access_token")).toThrow(
      SecretUnreadableError,
    );
  });

  it("never seals the same value to the same ciphertext twice", () => {
    expect(seal(KEY, "same", "c:k").ciphertext).not.toBe(seal(KEY, "same", "c:k").ciphertext);
  });

  it("keeps a key the provider quoted back out of the log", () => {
    expect(redactKeys("Incorrect API key provided: sk-proj-abc1****wxyz.")).toBe(
      "Incorrect API key provided: sk-<redacted>",
    );
  });
});
