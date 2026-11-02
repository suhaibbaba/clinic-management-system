import { describe, expect, it } from "vitest";
import { clinicAddresses, googleRedirectUri, parseDomain, parseHost } from "@web/vendor/lib/domain";

describe("a clinic's domains", () => {
  it("puts the website on its domain and the dashboard on its own dashboard domain", () => {
    expect(clinicAddresses("abuobaid.ps", "admin.abuobaid.ps")).toEqual({
      website: "https://abuobaid.ps",
      dashboard: "https://admin.abuobaid.ps",
    });
  });

  it("has no address for a domain it does not have", () => {
    expect(clinicAddresses(null, null)).toEqual({ website: null, dashboard: null });
  });

  it("gives Google the callback on the clinic's dashboard domain", () => {
    expect(googleRedirectUri("admin.abuobaid.ps")).toBe(
      "https://admin.abuobaid.ps/api/auth/google/callback",
    );
  });

  it.each([
    ["AbuObaid.PS", "abuobaid.ps"],
    ["https://www.abuobaid.ps/", "abuobaid.ps"],
    ["admin.abuobaid.ps", "abuobaid.ps"],
    ["clinic.example.co.uk", "clinic.example.co.uk"],
    ["", null],
    ["   ", null],
  ])("reads the website domain %j as %j", (input, domain) => {
    expect(parseDomain(input)).toBe(domain);
  });

  it.each([
    ["Admin.AbuObaid.PS", "admin.abuobaid.ps"],
    ["https://admin.abuobaid.ps/", "admin.abuobaid.ps"],
    ["", null],
  ])("keeps every label of the dashboard domain %j as %j", (input, host) => {
    expect(parseHost(input)).toBe(host);
  });

  it.each(["clinic", "bad_domain.com", "clinic.ps/page", "-clinic.ps"])("refuses %j", (input) => {
    expect(parseDomain(input)).toBeUndefined();
    expect(parseHost(input)).toBeUndefined();
  });
});
