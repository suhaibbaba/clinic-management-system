import type { Doctor } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { ownDoctorFirst } from "@web/modules/appointments/lib/doctor-filter";

const doctor = (id: string, userId: string): Doctor => ({ id, userId }) as Doctor;
const doctors = [doctor("d1", "u1"), doctor("d2", "u2"), doctor("d3", "u3")];

describe("doctor filter", () => {
  it("moves the reader's own doctor profile to the top", () => {
    expect(ownDoctorFirst(doctors, "u3").map((entry) => entry.id)).toEqual(["d3", "d1", "d2"]);
  });

  it("keeps the order for a reader without a doctor profile", () => {
    expect(ownDoctorFirst(doctors, "admin")).toBe(doctors);
    expect(ownDoctorFirst(doctors, undefined)).toBe(doctors);
  });
});
