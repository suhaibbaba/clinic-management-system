import { describe, expect, it } from "vitest";
import { outsideAppUrl } from "@web/shared/lib/open-outside-app";

const BASE = "https://clinic.example.com/website?tab=content";

describe("opening a link outside the installed app", () => {
  it("leaves a browser tab to follow the link itself", () => {
    expect(outsideAppUrl("/site/abu-obeid", BASE, "browser")).toBeNull();
    expect(outsideAppUrl("/site/abu-obeid", BASE, "desktop-app")).toBeNull();
  });

  it("hands the page to the Android browser with the address as its fallback", () => {
    expect(outsideAppUrl("/site/abu-obeid/about?lang=en", BASE, "android-app")).toBe(
      "intent://clinic.example.com/site/abu-obeid/about?lang=en#Intent;scheme=https;" +
        "action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;" +
        "S.browser_fallback_url=https%3A%2F%2Fclinic.example.com%2Fsite%2Fabu-obeid%2Fabout%3Flang%3Den;end",
    );
  });

  it("hands the page to Safari on iOS", () => {
    expect(outsideAppUrl("/site/abu-obeid", BASE, "ios-app")).toBe(
      "x-safari-https://clinic.example.com/site/abu-obeid",
    );
  });

  it("never rewrites a link that is not a web page", () => {
    expect(outsideAppUrl("tel:+970599000101", BASE, "android-app")).toBeNull();
    expect(outsideAppUrl("mailto:info@example.com", BASE, "ios-app")).toBeNull();
  });
});
