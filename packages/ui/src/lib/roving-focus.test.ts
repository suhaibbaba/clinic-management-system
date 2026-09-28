import { afterEach, describe, expect, it } from "vitest";
import { rovingStop, rovingTarget } from "@ui/lib/roving-focus";

const TABS = ["orders", "done", "directory"] as const;

afterEach(() => {
  document.documentElement.dir = "";
});

describe("roving focus", () => {
  it("steps with the arrow keys and wraps at both ends", () => {
    expect(rovingTarget("ArrowDown", TABS, "orders")).toBe("done");
    expect(rovingTarget("ArrowDown", TABS, "directory")).toBe("orders");
    expect(rovingTarget("ArrowUp", TABS, "orders")).toBe("directory");
  });

  it("jumps with Home and End and ignores other keys", () => {
    expect(rovingTarget("End", TABS, "orders")).toBe("directory");
    expect(rovingTarget("Home", TABS, "directory")).toBe("orders");
    expect(rovingTarget("Enter", TABS, "orders")).toBeUndefined();
  });

  it("mirrors left and right in a right-to-left page", () => {
    expect(rovingTarget("ArrowRight", TABS, "orders")).toBe("done");

    document.documentElement.dir = "rtl";

    expect(rovingTarget("ArrowLeft", TABS, "orders")).toBe("done");
    expect(rovingTarget("ArrowRight", TABS, "orders")).toBe("directory");
  });

  it("keeps one tab stop, on the chosen value or else the first", () => {
    expect(rovingStop(TABS, "done")).toBe("done");
    expect(rovingStop<string>(TABS, "missing")).toBe("orders");
  });
});
