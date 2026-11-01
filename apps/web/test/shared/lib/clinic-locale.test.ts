import {
  bothNames,
  clinicLocale,
  joinPersonName,
  localized,
  lookupLabel,
  LOOKUP_LIST,
  normalizeArabic,
} from "@clinic/shared";
import { afterEach, describe, expect, it } from "vitest";
import { setClinicLocale } from "@web/shared/lib/clinic-locale";
import { formatMinute, formatTime, moneyText } from "@web/shared/lib/format";

const plain = (value: string): string => value.replace(/[⁦⁩]/g, "");

afterEach(() => {
  setClinicLocale(clinicLocale({ country: "PS" }));
});

describe("a clinic's locale profile", () => {
  it("takes every default from the country", () => {
    expect(clinicLocale({ country: "TR" })).toEqual({
      country: "TR",
      currency: "TRY",
      timeZone: "Europe/Istanbul",
      languages: ["tr", "en"],
      primaryLanguage: "tr",
      clock: "24h",
      weekStart: 1,
      numberLocale: "tr-TR-u-nu-latn",
    });
  });

  it("lets the clinic's own settings win over the country", () => {
    const locale = clinicLocale({
      country: "PS",
      currency: "USD",
      settings: { timezone: "Asia/Amman", locale: { languages: ["en", "ar"], clock: "24h" } },
    });

    expect(locale).toMatchObject({
      currency: "USD",
      timeZone: "Asia/Amman",
      primaryLanguage: "en",
      clock: "24h",
      weekStart: 6,
    });
  });

  it("ignores a broken locale section and keeps the country's", () => {
    expect(
      clinicLocale({ country: "PS", settings: { locale: { languages: ["xx"] } } }),
    ).toMatchObject({ languages: ["ar", "en"] });
  });
});

describe("text stored per language", () => {
  it("reads the reader's language, then the given fallbacks, then English, then anything", () => {
    const name = { tr: "Diş", ar: "سن" };

    expect(localized(name, "tr")).toBe("Diş");
    expect(localized(name, "en", ["ar"])).toBe("سن");
    expect(localized({ ar: "سن", en: "Tooth" }, "tr")).toBe("Tooth");
    expect(localized({ ar: "سن" }, "tr")).toBe("سن");
    expect(localized(null, "ar")).toBe("");
  });

  it("joins first and last names language by language", () => {
    expect(joinPersonName({ tr: "Ayşe", en: "Ayse" }, { tr: "Yılmaz" })).toEqual({
      tr: "Ayşe Yılmaz",
      en: "Ayse",
    });
  });

  it("shows every language once", () => {
    expect(bothNames({ ar: "سارة", en: "Sara", tr: "Sara" })).toBe("سارة — Sara");
  });

  it("names an English-only list in English whatever the reader's language", () => {
    expect(
      lookupLabel({ listKey: LOOKUP_LIST.ITEM_UNIT, name: { en: "box", tr: "kutu" } }, "tr"),
    ).toBe("box");
  });

  it("folds Turkish letters so a name typed without them still matches", () => {
    expect(normalizeArabic("İSTANBUL Şükrü Işık")).toBe("istanbul sukru isik");
  });
});

describe("formatting follows the clinic", () => {
  it("writes a 24-hour time for a clinic on a 24-hour clock", () => {
    setClinicLocale(clinicLocale({ country: "TR" }));

    expect(formatMinute(14 * 60 + 5)).toBe("14:05");
    expect(plain(formatTime("2026-05-09T11:30:00.000Z"))).toBe("14:30");
  });

  it("groups money the way the clinic's country writes it", () => {
    setClinicLocale(clinicLocale({ country: "TR" }));
    expect(plain(moneyText("1250000.00", "TRY"))).toBe("1.250.000 ₺");

    setClinicLocale(clinicLocale({ country: "PS" }));
    expect(plain(moneyText("1250000.00", "ILS"))).toBe("1,250,000 ₪");
  });
});
