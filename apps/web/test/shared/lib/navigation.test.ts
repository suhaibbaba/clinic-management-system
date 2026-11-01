import { USER_ROLE } from "@clinic/shared";
import { canFor, SHIPPED_CAPABILITIES } from "@test/helpers/fixtures";
import { describe, expect, it } from "vitest";
import { backTarget, visibleNavGroups } from "@web/shared/lib/navigation";

describe("the back button's target", () => {
  it("leads each inner page to its parent list", () => {
    expect(backTarget("/patients/p-1", canFor(USER_ROLE.ADMIN))).toEqual({
      to: "/patients",
      label: "nav.patients",
    });
    expect(backTarget("/labs/l-1", canFor(USER_ROLE.ADMIN))?.to).toBe("/labs?tab=directory");
    expect(backTarget("/inventory/items/i-1", canFor(USER_ROLE.ADMIN))?.to).toBe("/inventory");
    expect(backTarget("/inventory/shopping-list", canFor(USER_ROLE.ADMIN))?.to).toBe("/inventory");
    expect(backTarget("/inventory/purchases/new", canFor(USER_ROLE.TECHNICIAN))?.to).toBe(
      "/inventory",
    );
    expect(backTarget("/inventory/counts/c-1", canFor(USER_ROLE.TECHNICIAN))?.to).toBe(
      "/inventory",
    );
    expect(backTarget("/inventory/requests/r-1", canFor(USER_ROLE.DOCTOR))?.to).toBe(
      "/inventory?tab=requests",
    );
    expect(backTarget("/inventory/suppliers/s-1", canFor(USER_ROLE.ADMIN))?.to).toBe(
      "/inventory?tab=suppliers",
    );
    expect(backTarget("/doctors/d-1", canFor(USER_ROLE.ADMIN))?.to).toBe("/users?view=doctors");
    expect(backTarget("/profile", canFor(USER_ROLE.RECEPTIONIST))?.to).toBe("/dashboard");
    expect(backTarget("/payroll/u-1", canFor(USER_ROLE.ADMIN))?.to).toBe("/finance");
    expect(backTarget("/payroll/settings", canFor(USER_ROLE.ADMIN))?.to).toBe("/finance");
  });

  it("offers nothing on a section the sidebar already reaches", () => {
    for (const path of [
      "/dashboard",
      "/patients",
      "/labs",
      "/inventory",
      "/users",
      "/clinic/lists",
      "/clinic/prices",
      "/finance",
    ]) {
      expect(backTarget(path, canFor(USER_ROLE.ADMIN))).toBeUndefined();
    }
  });

  it("never points a reader at a parent its route guard would bounce", () => {
    expect(backTarget("/doctors/d-1", canFor(USER_ROLE.RECEPTIONIST))).toBeUndefined();
    expect(backTarget("/payroll/u-1", canFor(USER_ROLE.RECEPTIONIST))).toBeUndefined();
    expect(backTarget("/inventory/suppliers/s-1", canFor(USER_ROLE.RECEPTIONIST))).toBeUndefined();
    expect(backTarget("/patients/p-1", undefined)).toBeUndefined();
  });
});

describe("the sidebar's group titles", () => {
  const titles = (withdrawn: readonly string[]) =>
    visibleNavGroups(
      (capability) =>
        SHIPPED_CAPABILITIES[USER_ROLE.ADMIN].includes(capability) &&
        !withdrawn.includes(capability),
    ).map((group) => [group.label, group.items.map((item) => item.to)]);

  it("names each group while everything it names is there", () => {
    expect(titles([])).toEqual([
      [undefined, ["/dashboard", "/assistant"]],
      ["nav.groups.care", ["/patients", "/appointments", "/my-earnings"]],
      ["nav.groups.stores", ["/labs", "/inventory"]],
    ]);
  });

  it("drops a title that would name a section the clinic no longer has", () => {
    expect(titles(["appointments.list", "inventory.list"])).toEqual([
      [undefined, ["/dashboard", "/assistant"]],
      [undefined, ["/patients", "/my-earnings"]],
      [undefined, ["/labs"]],
    ]);
  });
});
