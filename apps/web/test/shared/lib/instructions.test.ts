import { describe, expect, it } from "vitest";
import { hasInstruction, toggleInstruction } from "@web/shared/lib/instructions";

describe("drug instructions", () => {
  it("adds a phrase after what is already written", () => {
    expect(toggleInstruction("", "بعد الأكل", "، ")).toBe("بعد الأكل");
    expect(toggleInstruction("بعد الأكل", "قبل النوم", "، ")).toBe("بعد الأكل، قبل النوم");
  });

  it("takes a phrase out again, whichever comma separates it", () => {
    expect(toggleInstruction("بعد الأكل، قبل النوم", "بعد الأكل", "، ")).toBe("قبل النوم");
    expect(toggleInstruction("After meals, At bedtime", "At bedtime", ", ")).toBe("After meals");
  });

  it("knows a phrase only as a whole part, not inside another", () => {
    expect(hasInstruction("بعد الأكل بساعة", "بعد الأكل")).toBe(false);
    expect(hasInstruction(" بعد الأكل ،قبل النوم", "قبل النوم")).toBe(true);
  });
});
