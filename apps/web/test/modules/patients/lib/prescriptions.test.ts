import { describe, expect, it } from "vitest";
import {
  describeItem,
  drugSuggestions,
  isKnownDrug,
} from "@web/modules/patients/lib/prescriptions";

describe("describeItem", () => {
  it("isolates the shorthand so a right-to-left line keeps it in order", () => {
    expect(describeItem({ drug: "Amoxicillin 500 mg", perDose: 1, timesPerDay: 2, days: 7 })).toBe(
      "⁦1×2×7⁩",
    );
  });

  it("keeps the free text an older prescription was written with", () => {
    expect(
      describeItem({ drug: "Ibuprofen", dose: "400 mg", frequency: "BID", duration: "5 أيام" }),
    ).toBe("400 mg · BID · 5 أيام");
  });
});

describe("drugSuggestions", () => {
  const drugs = [
    { key: "amoxicillin_500", label: "Amoxicillin 500 mg" },
    { key: "amoxiclav_1g", label: "Amoxicillin/clavulanate 1 g" },
    { key: "ibuprofen_400", label: "Ibuprofen 400 mg" },
  ];

  it("offers every frequent drug before anything is typed, up to the limit", () => {
    expect(drugSuggestions(drugs, "")).toHaveLength(3);
    expect(drugSuggestions(drugs, "", 2)).toHaveLength(2);
  });

  it("narrows to what is typed, whatever the case", () => {
    expect(drugSuggestions(drugs, "amox").map((drug) => drug.key)).toEqual([
      "amoxicillin_500",
      "amoxiclav_1g",
    ]);
  });

  it("steps aside once the name is one of them", () => {
    expect(drugSuggestions(drugs, "ibuprofen 400 mg")).toEqual([]);
  });
});

describe("isKnownDrug", () => {
  const drugs = [{ key: "a", label: "Ibuprofen 400 mg" }];

  it("matches a frequent drug whatever the case or surrounding spaces", () => {
    expect(isKnownDrug(drugs, "  ibuprofen 400 MG ")).toBe(true);
    expect(isKnownDrug(drugs, "Ibuprofen")).toBe(false);
  });
});
