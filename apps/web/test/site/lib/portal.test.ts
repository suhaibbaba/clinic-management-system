import type { PortalAccount, PortalAppointment } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  appointmentTone,
  chosenPatient,
  netPrice,
  partOfDay,
  portalDate,
  portalDateParts,
  portalDateTime,
  portalMoney,
  portalTab,
  portalWeekday,
  revealedCount,
  splitAppointments,
  treatmentTone,
} from "@web/site/lib/portal";

const doctor = { ar: "د. سارة", en: "Dr Sara" };

const appointment = (id: string, startsAt: string, status: PortalAppointment["status"]) => ({
  id,
  startsAt,
  durationMinutes: 30,
  status,
  doctor,
});

describe("patient account helpers", () => {
  it("writes a date in the clinic's time zone, not the browser's", () => {
    expect(portalDate("2026-05-08T22:30:00.000Z", "Asia/Hebron")).toBe("09/05/2026");
    expect(portalDateTime("2026-05-09T07:30:00.000Z", "Asia/Hebron")).toBe("09/05/2026 · 10:30 AM");
  });

  it("splits a date into day, numbered month and year in the clinic's time zone", () => {
    expect(portalDateParts("2026-05-08T22:30:00.000Z", "Asia/Hebron")).toEqual({
      day: "09",
      month: "05",
      year: "2026",
    });
    expect(portalDateParts("2026-06-30T09:00:00.000Z", "Asia/Hebron")).toEqual({
      day: "30",
      month: "06",
      year: "2026",
    });
    expect(portalWeekday("2026-05-08T22:30:00.000Z", "en", "Asia/Hebron")).toBe("Saturday");
  });

  it("greets by the clinic's hour, not the browser's", () => {
    expect(partOfDay(new Date("2026-05-09T08:59:00.000Z"), "Asia/Hebron")).toBe("morning");
    expect(partOfDay(new Date("2026-05-09T09:00:00.000Z"), "Asia/Hebron")).toBe("evening");
    expect(partOfDay(new Date("2026-05-08T21:30:00.000Z"), "Asia/Hebron")).toBe("morning");
  });

  it("shows a tail of one or two rows at once instead of behind another button", () => {
    expect(revealedCount(5, 11)).toBe(5);
    expect(revealedCount(10, 11)).toBe(11);
    expect(revealedCount(10, 12)).toBe(12);
    expect(revealedCount(10, 13)).toBe(10);
    expect(revealedCount(5, 6)).toBe(6);
    expect(revealedCount(5, 3)).toBe(3);
  });

  it("colours each status apart", () => {
    expect(appointmentTone("completed")).toBe("success");
    expect(appointmentTone("no_show")).toBe("warning");
    expect(appointmentTone("cancelled")).toBe("neutral");
    expect(appointmentTone("confirmed")).toBe("primary");
    expect(treatmentTone("done")).toBe("success");
    expect(treatmentTone("cancelled")).toBe("neutral");
    expect(treatmentTone("planned")).toBe("warning");
  });

  it("shows money whole, with the currency's symbol", () => {
    expect(portalMoney("40.00", "ILS")).toBe("\u206640\u00A0₪\u2069");
    expect(netPrice("60.00", "15.00")).toBe("45.00");
  });

  it("falls back to the overview for an unknown tab", () => {
    expect(portalTab("billing")).toBe("billing");
    expect(portalTab("admin")).toBe("overview");
    expect(portalTab(null)).toBe("overview");
  });

  it("opens the asked-for patient only when they are on the account", () => {
    const account: PortalAccount = {
      clinicSlug: "c",
      currency: "ILS",
      timeZone: "Asia/Hebron",
      expiresAt: "2026-05-09T00:00:00.000Z",
      patients: [
        { id: "a", fullName: "A", firstName: "A", fileNumber: "1" },
        { id: "b", fullName: "B", firstName: "B", fileNumber: "2" },
      ],
    };

    expect(chosenPatient(account, "b")).toBe("b");
    expect(chosenPatient(account, "someone-else")).toBe("a");
  });

  it("lists open appointments ahead, soonest first, and everything else as history", () => {
    const now = new Date("2026-05-10T00:00:00.000Z");
    const { upcoming, past } = splitAppointments(
      [
        appointment("later", "2026-06-01T08:00:00.000Z", "confirmed"),
        appointment("soon", "2026-05-12T08:00:00.000Z", "requested"),
        appointment("cancelled", "2026-05-11T08:00:00.000Z", "cancelled"),
        appointment("done", "2026-05-01T08:00:00.000Z", "completed"),
      ],
      now,
    );

    expect(upcoming.map((item) => item.id)).toEqual(["soon", "later"]);
    expect(past.map((item) => item.id)).toEqual(["cancelled", "done"]);
  });
});
