import { describe, expect, it } from "vitest";
import { parseTeethInput } from "@web/shared/lib/teeth-input";

describe("parseTeethInput", () => {
  it("reads one FDI tooth", () => {
    expect(parseTeethInput(" 46 ")).toEqual([46]);
  });

  it("refuses what is not a tooth", () => {
    expect(parseTeethInput("")).toBeNull();
    expect(parseTeethInput("19")).toBeNull();
    expect(parseTeethInput("4.6")).toBeNull();
    expect(parseTeethInput("abc")).toBeNull();
  });

  it("expands a range within one quadrant, in either direction", () => {
    expect(parseTeethInput("14-17")).toEqual([17, 16, 15, 14]);
    expect(parseTeethInput("17-14")).toEqual([17, 16, 15, 14]);
  });

  it("follows the arch across the midline", () => {
    expect(parseTeethInput("13-23")).toEqual([13, 12, 11, 21, 22, 23]);
    expect(parseTeethInput("33 – 43")).toEqual([43, 42, 41, 31, 32, 33]);
  });

  it("covers the deciduous arches", () => {
    expect(parseTeethInput("52-62")).toEqual([52, 51, 61, 62]);
  });

  it("refuses a range across the jaws or the dentitions", () => {
    expect(parseTeethInput("16-36")).toBeNull();
    expect(parseTeethInput("55-16")).toBeNull();
    expect(parseTeethInput("14-19")).toBeNull();
  });
});
