import {
  DASHBOARD_KEY_NUMBER,
  DASHBOARD_WIDGET,
  DASHBOARD_WIDTH,
  DASHBOARD_ZONE,
  RULE,
  USER_ROLE,
  USER_ROLES,
  type DashboardLayout,
  type DashboardLayouts,
  type UserRole,
} from "@clinic/shared";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Dashboard layouts (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let coreOnly: TestClinic;

  const login = async (target: TestClinic, role: UserRole) =>
    auth(await context.login(target.phones[role]));

  const layoutOf = async (target: TestClinic, role: UserRole): Promise<DashboardLayout> => {
    const response = await context.app.inject({
      method: "GET",
      url: "/dashboard/layout",
      headers: await login(target, role),
    });

    expect(response.statusCode).toBe(200);

    return response.json<DashboardLayout>();
  };

  const visibleIds = (layout: DashboardLayout): string[] =>
    layout.widgets.filter((widget) => widget.visible).map((widget) => widget.id);

  const save = async (target: TestClinic, role: UserRole, layout: DashboardLayout) =>
    context.app.inject({
      method: "PUT",
      url: "/dashboard/layouts",
      headers: await login(target, USER_ROLE.ADMIN),
      payload: { layouts: [{ role, layout }] },
    });

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    coreOnly = await context.createClinic({ modules: [] });
    context.resetThrottle();
  });

  afterAll(async () => {
    await context.close();
  });

  it("gives every role the standard dashboard until the admin changes it", async () => {
    const layout = await layoutOf(clinic, USER_ROLE.RECEPTIONIST);

    expect(visibleIds(layout)).toEqual([
      DASHBOARD_WIDGET.GREETING,
      DASHBOARD_WIDGET.KEY_NUMBERS,
      DASHBOARD_WIDGET.SCHEDULE,
      DASHBOARD_WIDGET.VISITS_TODAY,
      DASHBOARD_WIDGET.QUICK_ACTIONS,
      DASHBOARD_WIDGET.CALENDAR,
      DASHBOARD_WIDGET.TOP_DEBTS,
      DASHBOARD_WIDGET.NOTES,
    ]);
    expect(layout.keyNumbers).toEqual([
      DASHBOARD_KEY_NUMBER.APPOINTMENTS_TODAY,
      DASHBOARD_KEY_NUMBER.PENDING_BOOKINGS,
      DASHBOARD_KEY_NUMBER.VISITS_TODAY,
      DASHBOARD_KEY_NUMBER.COLLECTED_TODAY,
      DASHBOARD_KEY_NUMBER.OVERDUE,
    ]);
  });

  it("leaves out the appointments widgets for a clinic without the module", async () => {
    const layout = await layoutOf(coreOnly, USER_ROLE.ADMIN);
    const ids = layout.widgets.map((widget) => widget.id);

    expect(ids).not.toContain(DASHBOARD_WIDGET.SCHEDULE);
    expect(ids).not.toContain(DASHBOARD_WIDGET.CALENDAR);
    expect(visibleIds(layout)).toEqual([
      DASHBOARD_WIDGET.GREETING,
      DASHBOARD_WIDGET.KEY_NUMBERS,
      DASHBOARD_WIDGET.VISITS_TODAY,
      DASHBOARD_WIDGET.QUICK_ACTIONS,
      DASHBOARD_WIDGET.TOP_DEBTS,
      DASHBOARD_WIDGET.NOTES,
    ]);
    expect(layout.keyNumbers).toEqual([
      DASHBOARD_KEY_NUMBER.VISITS_TODAY,
      DASHBOARD_KEY_NUMBER.COLLECTED_TODAY,
      DASHBOARD_KEY_NUMBER.OVERDUE,
    ]);
  });

  it("shows a role the layout the admin saved for it", async () => {
    const response = await save(clinic, USER_ROLE.RECEPTIONIST, {
      widgets: [
        {
          id: DASHBOARD_WIDGET.SCHEDULE,
          zone: DASHBOARD_ZONE.MAIN,
          width: DASHBOARD_WIDTH.TWO_THIRDS,
          visible: true,
        },
        {
          id: DASHBOARD_WIDGET.NOTES,
          zone: DASHBOARD_ZONE.MAIN,
          width: DASHBOARD_WIDTH.THIRD,
          visible: true,
        },
        {
          id: DASHBOARD_WIDGET.GREETING,
          zone: DASHBOARD_ZONE.TOP,
          width: DASHBOARD_WIDTH.FULL,
          visible: false,
        },
      ],
      keyNumbers: [DASHBOARD_KEY_NUMBER.PENDING_BOOKINGS],
    });

    expect(response.statusCode).toBe(200);

    const layout = await layoutOf(clinic, USER_ROLE.RECEPTIONIST);

    expect(layout.widgets.slice(0, 2)).toEqual([
      {
        id: DASHBOARD_WIDGET.SCHEDULE,
        zone: DASHBOARD_ZONE.MAIN,
        width: DASHBOARD_WIDTH.TWO_THIRDS,
        visible: true,
      },
      {
        id: DASHBOARD_WIDGET.NOTES,
        zone: DASHBOARD_ZONE.MAIN,
        width: DASHBOARD_WIDTH.THIRD,
        visible: true,
      },
    ]);
    expect(visibleIds(layout)).not.toContain(DASHBOARD_WIDGET.GREETING);
    expect(layout.keyNumbers).toEqual([DASHBOARD_KEY_NUMBER.PENDING_BOOKINGS]);
    expect(visibleIds(await layoutOf(clinic, USER_ROLE.DOCTOR))).toContain(
      DASHBOARD_WIDGET.GREETING,
    );
  });

  it("marks the saved role as customized and the rest as standard", async () => {
    const response = await context.app.inject({
      method: "GET",
      url: "/dashboard/layouts",
      headers: await login(clinic, USER_ROLE.ADMIN),
    });
    const roles = response.json<DashboardLayouts>().roles;

    expect(roles.map((entry) => entry.role)).toEqual([...USER_ROLES]);
    expect(roles.find((entry) => entry.role === USER_ROLE.RECEPTIONIST)).toMatchObject({
      customized: true,
      updatedAt: expect.any(String),
    });
    expect(roles.find((entry) => entry.role === USER_ROLE.DOCTOR)).toMatchObject({
      customized: false,
      updatedAt: null,
    });
  });

  it("drops a key number whose permission the role loses", async () => {
    await save(clinic, USER_ROLE.DOCTOR, {
      widgets: [],
      keyNumbers: [DASHBOARD_KEY_NUMBER.OVERDUE, DASHBOARD_KEY_NUMBER.APPOINTMENTS_TODAY],
    });
    await context.app.inject({
      method: "PATCH",
      url: "/permissions",
      headers: await login(clinic, USER_ROLE.ADMIN),
      payload: { role: USER_ROLE.DOCTOR, capability: RULE.OVERDUE_WIDGET, allowed: false },
    });

    expect((await layoutOf(clinic, USER_ROLE.DOCTOR)).keyNumbers).toEqual([
      DASHBOARD_KEY_NUMBER.APPOINTMENTS_TODAY,
    ]);
  });

  it("keeps a widget in a zone it may sit in", async () => {
    await save(clinic, USER_ROLE.TECHNICIAN, {
      widgets: [
        {
          id: DASHBOARD_WIDGET.SCHEDULE,
          zone: DASHBOARD_ZONE.SIDE,
          width: DASHBOARD_WIDTH.HALF,
          visible: true,
        },
      ],
      keyNumbers: [],
    });

    expect((await layoutOf(clinic, USER_ROLE.TECHNICIAN)).widgets[0]).toEqual({
      id: DASHBOARD_WIDGET.SCHEDULE,
      zone: DASHBOARD_ZONE.MAIN,
      width: DASHBOARD_WIDTH.HALF,
      visible: true,
    });
  });

  it("refuses an unknown widget", async () => {
    const response = await context.app.inject({
      method: "PUT",
      url: "/dashboard/layouts",
      headers: await login(clinic, USER_ROLE.ADMIN),
      payload: {
        layouts: [
          {
            role: USER_ROLE.DOCTOR,
            layout: {
              widgets: [{ id: "weather", zone: "main", width: "full", visible: true }],
              keyNumbers: [],
            },
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
    "refuses the layouts of every role to the %s",
    async (role) => {
      const headers = await login(clinic, role);
      const list = await context.app.inject({ method: "GET", url: "/dashboard/layouts", headers });
      const put = await context.app.inject({
        method: "PUT",
        url: "/dashboard/layouts",
        headers,
        payload: { layouts: [{ role, layout: { widgets: [], keyNumbers: [] } }] },
      });

      expect([list.statusCode, put.statusCode]).toEqual([403, 403]);
    },
  );
});
