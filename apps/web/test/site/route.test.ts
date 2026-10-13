import { describe, expect, it } from "vitest";
import { sitePage, siteSource } from "@web/site/route";

describe("site sources", () => {
  it("reads a clinic's handle, the editor's preview, and otherwise the host", () => {
    expect(siteSource("/site/abu-obaid/services")).toEqual({
      source: { kind: "slug", slug: "abu-obaid" },
      base: "/site/abu-obaid",
    });
    expect(siteSource("/site/preview/doctors")).toEqual({
      source: { kind: "preview" },
      base: "/site/preview",
    });
    expect(siteSource("/contact")).toEqual({ source: { kind: "host" }, base: "" });
  });
});

describe("site pages", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("maps each path below the base to its page", () => {
    expect(sitePage("/site/x", "/site/x")).toEqual({ kind: "home" });
    expect(sitePage("/site/x/", "/site/x")).toEqual({ kind: "home" });
    expect(sitePage("/services", "")).toEqual({ kind: "services" });
    expect(sitePage("/doctors", "")).toEqual({ kind: "doctors" });
    expect(sitePage(`/doctors/${id}`, "")).toEqual({ kind: "doctor", id });
    expect(sitePage("/appointment", "")).toEqual({ kind: "booking" });
    expect(sitePage("/contact/", "")).toEqual({ kind: "contact" });
  });

  it("answers not found for anything else", () => {
    expect(sitePage("/doctors/not-an-id", "")).toEqual({ kind: "notFound" });
    expect(sitePage("/services/extra", "")).toEqual({ kind: "notFound" });
    expect(sitePage("/patients", "")).toEqual({ kind: "notFound" });
  });
});
