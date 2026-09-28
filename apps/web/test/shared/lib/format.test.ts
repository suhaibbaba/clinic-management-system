import type { Clinic } from "@clinic/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { setClinicTimeZone } from "@web/shared/lib/clinic-zone";
import { dayBounds } from "@web/shared/lib/dates";
import {
  formatDate,
  formatDateTime,
  formatMinute,
  formatPeriod,
  formatTime,
} from "@web/shared/lib/format";
import { makeClinic } from "@test/helpers/fixtures";

const plain = (value: string): string => value.replace(/[⁦⁩]/g, "");

beforeAll(() => {
  setClinicTimeZone({
    ...makeClinic(),
    settings: { timezone: "Asia/Hebron" },
  } as unknown as Clinic);
});

describe("one date and time format across the app", () => {
  it("writes a date as day, short month and year in the clinic's zone", () => {
    expect(plain(formatDate("2026-05-09T07:30:00.000Z"))).toBe("9 May 2026");
    expect(plain(formatDate("2026-05-08T22:30:00.000Z"))).toBe("9 May 2026");
  });

  it("reads a bare calendar date as that day, whatever the zone", () => {
    expect(plain(formatDate("2026-05-09"))).toBe("9 May 2026");
  });

  it("writes a time on a 12-hour clock with AM or PM, never ص or م", () => {
    expect(plain(formatTime("2026-05-09T07:30:00.000Z"))).toBe("10:30 AM");
    expect(plain(formatTime("2026-05-09T12:05:00.000Z"))).toBe("3:05 PM");
  });

  it("joins date and time with a middle dot and no Arabic comma", () => {
    expect(plain(formatDateTime("2026-05-09T07:30:00.000Z"))).toBe("9 May 2026 · 10:30 AM");
  });

  it("names the day once for a period within one day", () => {
    expect(plain(formatPeriod("2026-05-09T07:30:00.000Z", "2026-05-09T08:00:00.000Z"))).toBe(
      "9 May 2026 · 10:30 AM – 11:00 AM",
    );
    expect(plain(formatPeriod("2026-05-09T07:30:00.000Z", "2026-05-10T08:00:00.000Z"))).toBe(
      "9 May 2026 · 10:30 AM – 10 May 2026 · 11:00 AM",
    );
  });

  it("keeps each value in one left-to-right island inside Arabic text", () => {
    expect(formatDateTime("2026-05-09T07:30:00.000Z")).toMatch(/^⁦.*⁩$/);
  });

  it("labels a minute of the day on the same 12-hour clock", () => {
    expect(formatMinute(7 * 60)).toBe("7:00 AM");
    expect(formatMinute(9 * 60 + 30)).toBe("9:30 AM");
    expect(formatMinute(22 * 60)).toBe("10:00 PM");
  });

  it("bounds a day range by the clinic's midnights, the end day included", () => {
    expect(dayBounds("2026-05-09", "2026-05-10")).toEqual({
      from: "2026-05-08T21:00:00.000Z",
      to: "2026-05-10T21:00:00.000Z",
    });
    expect(dayBounds("", "")).toEqual({});
  });
});
