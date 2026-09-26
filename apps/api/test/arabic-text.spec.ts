import { autoDirection, isolateLtr, visualRuns } from "@api/billing/pdf/arabic-text";

const drawn = (text: string, base: "rtl" | "ltr" = "rtl"): string =>
  visualRuns(text, base)
    .map((run) => run.text)
    .join("|");

describe("Arabic text", () => {
  describe("visual ordering", () => {
    it("keeps a pure Arabic line as one run for fontkit to shape and reverse", () => {
      const runs = visualRuns("إيصال قبض");

      expect(runs).toHaveLength(1);
      expect(runs[0]?.shapedRtl).toBe(true);
      // Logical order: the font reverses what it shapes.
      expect(runs[0]?.text).toBe("إيصال قبض");
    });

    it("puts a price to the left of the Arabic that introduces it", () => {
      const runs = visualRuns("المبلغ: 150");

      expect(runs[0]?.text).toContain("150");
      expect((runs[0]?.level ?? 1) % 2).toBe(0);
      expect((runs.at(-1)?.level ?? 0) % 2).toBe(1);
    });

    it("reads a date left to right inside a right-to-left line", () => {
      const digits = visualRuns("التاريخ 2026/09/05").find((run) => run.text.includes("2026"));

      expect(digits?.text.trim()).toBe("2026/09/05");
    });

    it("has nothing to order in an empty line", () => {
      expect(visualRuns("")).toEqual([]);
    });
  });

  // fontkit mirrors nothing: an unswapped bracket faces out of the words it holds.
  describe("brackets", () => {
    it("swaps a bracket inside Arabic, before the font reverses the run", () => {
      expect(visualRuns("حشوة (مؤقتة)")[0]?.text).toBe("حشوة )مؤقتة(");
    });

    it("swaps the brackets round a shekel sign after an Arabic word", () => {
      expect(drawn("الرصيد (₪)")).toBe("الرصيد )₪(");
    });

    it("swaps and reverses brackets with no Arabic of their own", () => {
      // An English word inside Arabic brackets: the brackets are right-to-left runs of their own.
      expect(drawn("قيد (Scaling) عكسي")).toContain(")");
      expect(drawn("قيد (Scaling) عكسي")).not.toContain("(Scaling)");
    });

    it("leaves brackets alone in a left-to-right run", () => {
      expect(drawn("Teeth whitening (temporary)", "ltr")).toBe("Teeth whitening (temporary)");
    });
  });

  describe("isolated numbers", () => {
    it("keeps the hash with its number after Arabic, as the screen does", () => {
      const runs = visualRuns(`دفعة ${isolateLtr("#000056")}`);
      const number = runs.find((run) => run.text.includes("000056"));

      expect(number?.text).toBe("#000056");
    });

    it("never hands the isolate marks to the font", () => {
      expect(drawn(isolateLtr("#000056"))).not.toMatch(/[⁦-⁩]/u);
    });
  });

  describe("direction by first letter", () => {
    it("reads a note as left to right when it starts in English", () => {
      expect(autoDirection("Treatment plans (2)", "rtl")).toBe("ltr");
    });

    it("reads it as right to left when it starts in Arabic", () => {
      expect(autoDirection("دفعة على الحساب", "ltr")).toBe("rtl");
    });

    it("falls back to the sheet's direction when there is no letter at all", () => {
      expect(autoDirection("150 — 200", "rtl")).toBe("rtl");
    });
  });
});
