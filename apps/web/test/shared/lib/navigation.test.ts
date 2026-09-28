import { USER_ROLE } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { backTarget } from "@web/shared/lib/navigation";

describe("the back button's target", () => {
  it("leads each inner page to its parent list", () => {
    expect(backTarget("/patients/p-1", USER_ROLE.ADMIN)).toEqual({
      to: "/patients",
      label: "nav.patients",
    });
    expect(backTarget("/labs/l-1", USER_ROLE.ADMIN)?.to).toBe("/labs?tab=directory");
    expect(backTarget("/inventory/items/i-1", USER_ROLE.ADMIN)?.to).toBe("/inventory");
    expect(backTarget("/inventory/shopping-list", USER_ROLE.ADMIN)?.to).toBe("/inventory");
    expect(backTarget("/doctors/d-1", USER_ROLE.ADMIN)?.to).toBe("/users?view=doctors");
    expect(backTarget("/profile", USER_ROLE.RECEPTIONIST)?.to).toBe("/dashboard");
  });

  it("offers nothing on a section the sidebar already reaches", () => {
    for (const path of [
      "/dashboard",
      "/patients",
      "/labs",
      "/inventory",
      "/users",
      "/clinic/lists",
    ]) {
      expect(backTarget(path, USER_ROLE.ADMIN)).toBeUndefined();
    }
  });

  it("never points a role at a parent its route guard would bounce", () => {
    expect(backTarget("/doctors/d-1", USER_ROLE.RECEPTIONIST)).toBeUndefined();
    expect(backTarget("/patients/p-1", undefined)).toBeUndefined();
  });
});
