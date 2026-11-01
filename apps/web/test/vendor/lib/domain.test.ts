import { describe, expect, it } from "vitest";
import { clinicAddresses, parseDomain } from "@web/vendor/lib/domain";

describe("a clinic's domain", () => {
  it("puts the website on the domain and the dashboard on admin. of it", () => {
    expect(clinicAddresses("abuobaid.ps")).toEqual({
      website: "https://abuobaid.ps",
      dashboard: "https://admin.abuobaid.ps",
    });
  });

  it.each([
    ["AbuObaid.PS", "abuobaid.ps"],
    ["https://www.abuobaid.ps/", "abuobaid.ps"],
    ["admin.abuobaid.ps", "abuobaid.ps"],
    ["clinic.example.co.uk", "clinic.example.co.uk"],
    ["", null],
    ["   ", null],
  ])("reads %j as %j", (input, domain) => {
    expect(parseDomain(input)).toBe(domain);
  });

  it.each(["clinic", "bad_domain.com", "clinic.ps/page", "-clinic.ps"])("refuses %j", (input) => {
    expect(parseDomain(input)).toBeUndefined();
  });
});
