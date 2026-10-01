import { describe, expect, it } from "vitest";
import { deviceName } from "@web/modules/profile/lib/device-name";

describe("the name a new passkey starts with", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15", "iPhone"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15", "iPad"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36", "Android"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", "Mac"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Windows"],
    ["Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36", "Chromebook"],
  ])("reads %s as %s", (userAgent, expected) => {
    expect(deviceName(userAgent)).toBe(expected);
  });

  it("leaves the name empty for a device it does not know", () => {
    expect(deviceName("curl/8.0")).toBe("");
  });
});
