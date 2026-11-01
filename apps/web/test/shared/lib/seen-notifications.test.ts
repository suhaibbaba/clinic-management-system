import { afterEach, describe, expect, it } from "vitest";
import {
  markAllSeen,
  readSeen,
  settleSeen,
  unseenCount,
  writeSeen,
} from "@web/shared/lib/seen-notifications";

describe("seen notifications", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("counts everything waiting until it is marked read", () => {
    const counts = { pendingBookings: 3, overdueLabs: 2 };

    expect(unseenCount(counts, {})).toBe(5);
    expect(unseenCount(counts, markAllSeen(counts, {}))).toBe(0);
  });

  it("counts only what arrived after marking read", () => {
    const seen = markAllSeen({ pendingBookings: 3, overdueLabs: 2 }, {});

    expect(unseenCount({ pendingBookings: 5, overdueLabs: 2 }, seen)).toBe(2);
  });

  it("ignores a count still loading and keeps what was seen of it", () => {
    const seen = markAllSeen({ pendingBookings: 3, overdueLabs: undefined }, { overdueLabs: 4 });

    expect(seen).toEqual({ pendingBookings: 3, overdueLabs: 4 });
    expect(unseenCount({ pendingBookings: undefined, overdueLabs: 4 }, seen)).toBe(0);
  });

  it("lowers what was seen when the work shrinks, so a new item shows again", () => {
    const seen = settleSeen({ pendingBookings: 1 }, { pendingBookings: 3 });

    expect(seen).toEqual({ pendingBookings: 1 });
    expect(unseenCount({ pendingBookings: 2 }, seen)).toBe(1);
  });

  it("returns the same object when nothing shrank", () => {
    const seen = { pendingBookings: 3 };

    expect(settleSeen({ pendingBookings: 4, overdueLabs: undefined }, seen)).toBe(seen);
  });

  it("remembers what each user has read, apart", () => {
    writeSeen("a", { pendingBookings: 3 });

    expect(readSeen("a")).toEqual({ pendingBookings: 3 });
    expect(readSeen("b")).toEqual({});
  });

  it("drops a stored value that is not a count", () => {
    window.localStorage.setItem(
      "clinic.notifications.seen.a",
      JSON.stringify({ pendingBookings: "3", overdueLabs: -1, inventoryAlerts: 2 }),
    );

    expect(readSeen("a")).toEqual({ inventoryAlerts: 2 });

    window.localStorage.setItem("clinic.notifications.seen.a", "{broken");

    expect(readSeen("a")).toEqual({});
  });
});
