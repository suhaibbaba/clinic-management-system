import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@web/i18n";
import {
  applyLanguageToDocument,
  changeLanguage,
  initLanguage,
  storedLanguage,
} from "@web/i18n/language";

// Three things together, and the third is the forgotten one: change the strings, remember the
// choice, flip the document's direction.
describe("language", () => {
  afterEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("ar");
    applyLanguageToDocument("ar");
  });

  it("switches the strings, the direction and the stored choice together", async () => {
    await changeLanguage("en");

    expect(i18n.language).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("en");
    expect(storedLanguage()).toBe("en");
  });

  // English is its own chunk: the strings must be there by the time the switch resolves.
  it("has the English strings once the switch resolves", async () => {
    await changeLanguage("en");

    expect(i18n.t("common.save")).toBe("Save");
  });

  it("keeps a clinic's override when the English file arrives after it", async () => {
    // A fresh module, so English has not been fetched yet by an earlier test.
    vi.resetModules();
    const fresh = await import("@web/i18n");
    fresh.default.addResourceBundle(
      "en",
      "translation",
      { common: { cancel: "Dismiss" } },
      true,
      true,
    );

    await fresh.loadLanguage("en");
    await fresh.default.changeLanguage("en");

    expect(fresh.default.t("common.cancel")).toBe("Dismiss");
    expect(fresh.default.t("common.save")).toBe("Save");
  });

  it("goes back to right-to-left for Arabic", async () => {
    await changeLanguage("en");
    await changeLanguage("ar");

    expect(document.documentElement.dir).toBe("rtl");
    expect(storedLanguage()).toBe("ar");
  });

  it("restores the stored choice on the next boot", async () => {
    await changeLanguage("en");

    // A fresh load: the document starts as the HTML shell left it.
    applyLanguageToDocument("ar");
    await initLanguage();

    expect(document.documentElement.dir).toBe("ltr");
    expect(i18n.language).toBe("en");
  });

  it("falls back to Arabic when nothing is stored", async () => {
    window.localStorage.clear();
    await initLanguage();

    expect(document.documentElement.dir).toBe("rtl");
  });

  it("sets the direction before the strings change", async () => {
    let dirWhenStringsChanged: string | undefined;
    const onLanguageChanged = (): void => {
      dirWhenStringsChanged = document.documentElement.dir;
    };

    i18n.on("languageChanged", onLanguageChanged);
    await changeLanguage("en");
    i18n.off("languageChanged", onLanguageChanged);

    expect(dirWhenStringsChanged).toBe("ltr");
  });

  it("ignores a stored value that is not a language we ship", () => {
    window.localStorage.setItem("clinic.language", "fr");

    expect(storedLanguage()).toBeNull();
  });
});
