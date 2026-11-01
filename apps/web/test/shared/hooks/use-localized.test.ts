import { act, renderHook } from "@testing-library/react";
import type { LanguageCode } from "@clinic/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@web/i18n";
import { changeLanguage } from "@web/i18n/language";
import { useLocalized } from "@web/shared/hooks/use-localized";

let clinicLanguages: readonly LanguageCode[] = ["ar", "en"];

vi.mock("@web/shared/hooks/use-clinic-languages", () => ({
  useClinicLanguages: () => clinicLanguages,
}));

const NAME = { ar: "حشوة", en: "Filling", tr: "Dolgu" };

describe("useLocalized", () => {
  afterEach(async () => {
    window.localStorage.clear();
    clinicLanguages = ["ar", "en"];
    await changeLanguage("ar");
  });

  it("reads the text in the reader's language", async () => {
    await changeLanguage("en");
    const { result } = renderHook(() => useLocalized());

    expect(result.current(NAME)).toBe("Filling");
  });

  it("follows the reader when the language changes", async () => {
    await changeLanguage("ar");
    const { result } = renderHook(() => useLocalized());

    expect(result.current(NAME)).toBe("حشوة");

    await act(async () => {
      await changeLanguage("tr");
    });

    expect(result.current(NAME)).toBe("Dolgu");
  });

  it("falls back through the clinic's languages before any other", async () => {
    clinicLanguages = ["tr", "ar"];
    await changeLanguage("en");
    const { result } = renderHook(() => useLocalized());

    expect(result.current({ ar: "حشوة", tr: "Dolgu" })).toBe("Dolgu");
  });

  it("answers an empty string for missing text", () => {
    const { result } = renderHook(() => useLocalized());

    expect(result.current(null)).toBe("");
    expect(result.current({})).toBe("");
  });
});
