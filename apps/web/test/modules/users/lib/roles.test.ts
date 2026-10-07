import { USER_ROLE } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { assignableRoles } from "@web/modules/users/lib/roles";

describe("assignable roles", () => {
  it("offers no doctor role to a new user, since the doctors screen creates doctors", () => {
    expect(assignableRoles(undefined)).toEqual([
      USER_ROLE.ADMIN,
      USER_ROLE.TECHNICIAN,
      USER_ROLE.RECEPTIONIST,
    ]);
  });

  it("keeps a doctor's own role selectable", () => {
    expect(assignableRoles(USER_ROLE.DOCTOR)).toEqual([
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.TECHNICIAN,
      USER_ROLE.RECEPTIONIST,
    ]);
    expect(assignableRoles(USER_ROLE.VISITING_DOCTOR)).toContain(USER_ROLE.VISITING_DOCTOR);
    expect(assignableRoles(USER_ROLE.VISITING_DOCTOR)).not.toContain(USER_ROLE.DOCTOR);
  });

  it("offers no doctor role to other staff", () => {
    expect(assignableRoles(USER_ROLE.RECEPTIONIST)).not.toContain(USER_ROLE.DOCTOR);
    expect(assignableRoles(USER_ROLE.ADMIN)).not.toContain(USER_ROLE.DOCTOR);
  });
});
