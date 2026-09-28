import { afterEach, describe, expect, it } from "vitest";
import i18n from "@web/i18n";
import { changeLanguage } from "@web/i18n/language";
import { formatDuration } from "@web/shared/lib/duration";

describe("formatDuration", () => {
  afterEach(async () => {
    window.localStorage.clear();
    await changeLanguage("ar");
  });

  it("keeps minutes under an hour and splits an hour or more into hours and minutes", async () => {
    await changeLanguage("en");
    const t = i18n.getFixedT("en");

    expect(formatDuration(t, 45)).toBe("45 minutes");
    expect(formatDuration(t, 60)).toBe("1 hour");
    expect(formatDuration(t, 80)).toBe("1 hour and 20 minutes");
    expect(formatDuration(t, 180)).toBe("3 hours");
    expect(formatDuration(t, 121)).toBe("2 hours and 1 minute");
  });

  it("uses the Arabic plural forms", async () => {
    await changeLanguage("ar");
    const t = i18n.getFixedT("ar");

    expect(formatDuration(t, 80)).toBe("ساعة و20 دقيقة");
    expect(formatDuration(t, 120)).toBe("ساعتان");
    expect(formatDuration(t, 180)).toBe("3 ساعات");
    expect(formatDuration(t, 150)).toBe("ساعتان و30 دقيقة");
    expect(formatDuration(t, 45)).toBe("45 دقيقة");
    expect(formatDuration(t, 5)).toBe("5 دقائق");
  });
});
