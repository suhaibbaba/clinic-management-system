import { APPOINTMENT_STATUS, USER_ROLE, type UserRole } from "@clinic/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@web/app/router";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeDoctor, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type MockResponse } from "@test/helpers/render";
import { resetClinicTimeZone } from "@web/lib/clinic-zone";
import { choose } from "@test/select";

const DOCTOR_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_DOCTOR_ID = "22222222-2222-4222-8222-222222222222";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";

function setViewport(isMobile: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isMobile && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const today = new Date();
const iso = (at: Date): string =>
  `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}-${String(at.getUTCDate()).padStart(2, "0")}`;

function appointmentAt(hour: number, overrides: Record<string, unknown> = {}) {
  const startsAt = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hour, 0),
  );

  return {
    id: `appt-${hour}`,
    clinicId: "clinic",
    patientId: PATIENT_ID,
    doctorId: DOCTOR_ID,
    startsAt: startsAt.toISOString(),
    durationMinutes: 30,
    endsAt: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
    type: "checkup",
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: "فحص دوري",
    notes: null,
    visitId: null,
    cancelledReason: null,
    createdAt: startsAt.toISOString(),
    updatedAt: startsAt.toISOString(),
    patientName: "أحمد خالد الحسن",
    patientPhone: "+963931000001",
    patientFileNumber: "00001",
    doctorName: { ar: "د. ليلى حداد", en: "Dr. Layla Haddad" },
    ...overrides,
  };
}

function handlers(role: UserRole, overrides: Record<string, MockResponse | unknown> = {}) {
  const doctor = makeDoctor();

  return {
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role }) },
    "GET /clinic": { status: 200, body: { ...makeClinic(), settings: { timezone: "UTC" } } },
    "GET /doctors": {
      status: 200,
      body: paginated([
        {
          ...doctor,
          id: DOCTOR_ID,
          user: { ...doctor.user, name: { ar: "د. ليلى حداد", en: "Dr. Layla Haddad" } },
        },
        {
          ...doctor,
          id: OTHER_DOCTOR_ID,
          user: { ...doctor.user, name: { ar: "د. سامر نصار", en: "Dr. Samer Nassar" } },
        },
      ]),
    },
    "GET /waiting-list": { status: 200, body: paginated([]) },
    "GET /appointments/calendar": {
      status: 200,
      body: {
        from: iso(today),
        to: iso(today),
        appointments: [appointmentAt(10), appointmentAt(14, { id: "appt-14", status: "arrived" })],
      },
    },
    "GET /appointments/availability": {
      status: 200,
      body: {
        doctorId: DOCTOR_ID,
        date: iso(today),
        durationMinutes: 30,
        closedReason: null,
        slots: [
          { start: "09:00", end: "09:30", startsAt: new Date().toISOString(), available: true },
          { start: "09:30", end: "10:00", startsAt: new Date().toISOString(), available: false },
        ],
      },
    },
    ...overrides,
  } as Record<string, MockResponse>;
}

async function renderCalendar(role: UserRole, overrides = {}, route = "/appointments") {
  authTokens.clear();
  const api = mockApi(handlers(role, overrides));
  renderWithProviders(<AppRoutes />, { route });
  return api;
}

function Address(): JSX.Element {
  const location = useLocation();

  return <span data-testid="address">{`${location.pathname}${location.search}`}</span>;
}

const calendar = () => screen.findByRole("region", { name: ar.appointments.title });

const block = async (time: RegExp) => within(await calendar()).findByRole("button", { name: time });

describe("Appointments page", () => {
  beforeEach(() => {
    authTokens.clear();
    setViewport(false);
    resetClinicTimeZone();
  });

  it("draws every appointment as its own button, named by time, patient and status", async () => {
    await renderCalendar(USER_ROLE.RECEPTIONIST);

    expect(
      await block(new RegExp(`10:00.*أحمد خالد الحسن.*${ar.appointments.statuses.confirmed}`)),
    ).toBeInTheDocument();
  });

  it("opens the detail drawer on a block, with the actions that status allows", async () => {
    await renderCalendar(USER_ROLE.RECEPTIONIST);

    await userEvent.click(await block(/10:00/));

    const drawer = await screen.findByRole("dialog");

    expect(
      within(drawer).getByRole("button", { name: ar.appointments.actions.arrived }),
    ).toBeVisible();
    expect(
      within(drawer).queryByRole("button", { name: ar.appointments.actions.complete }),
    ).not.toBeInTheDocument();
  });

  it("drops an action the clinic has taken away, and keeps the rest", async () => {
    await renderCalendar(USER_ROLE.RECEPTIONIST, {
      "GET /me": {
        status: 200,
        body: makeProfile({
          role: USER_ROLE.RECEPTIONIST,
          capabilities: ["appointments.noShow"],
        }),
      },
    });

    await userEvent.click(await block(/10:00/));

    const drawer = await screen.findByRole("dialog");

    expect(
      within(drawer).queryByRole("button", { name: ar.appointments.actions.arrived }),
    ).not.toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: ar.appointments.actions.noShow }),
    ).toBeVisible();
  });

  it("offers a visit only once the patient has arrived", async () => {
    await renderCalendar(USER_ROLE.DOCTOR);

    await userEvent.click(await block(/2:00 PM/));
    const drawer = await screen.findByRole("dialog");

    expect(
      within(drawer).getByRole("button", { name: ar.appointments.actions.openVisit }),
    ).toBeVisible();
  });

  it("does not offer a receptionist the visit button — a visit is clinical", async () => {
    await renderCalendar(USER_ROLE.RECEPTIONIST);

    await userEvent.click(await block(/2:00 PM/));
    const drawer = await screen.findByRole("dialog");

    expect(
      within(drawer).queryByRole("button", { name: ar.appointments.actions.openVisit }),
    ).not.toBeInTheDocument();
  });

  it("shows the day as an agenda on a phone, with no week toggle", async () => {
    setViewport(true);
    await renderCalendar(USER_ROLE.RECEPTIONIST);

    await block(/10:00/);

    expect(screen.queryByRole("radio", { name: ar.appointments.week })).not.toBeInTheDocument();
  });

  it("opens the view the address names, and leaves the default out of it", async () => {
    await renderCalendar(USER_ROLE.RECEPTIONIST, {}, "/appointments?view=day");

    await block(/10:00/);

    expect(screen.getByRole("radio", { name: ar.appointments.day })).toBeChecked();
    expect(screen.getByRole("radio", { name: ar.appointments.week })).not.toBeChecked();
  });

  it("writes the view into the address when it is switched, and the default back out", async () => {
    const user = userEvent.setup();
    authTokens.clear();
    mockApi(handlers(USER_ROLE.RECEPTIONIST));
    renderWithProviders(
      <>
        <AppRoutes />
        <Address />
      </>,
      { route: "/appointments" },
    );

    await block(/10:00/);
    expect(screen.getByTestId("address")).toHaveTextContent("/appointments");
    expect(screen.getByTestId("address").textContent).not.toContain("view=");

    await user.click(screen.getByRole("radio", { name: ar.appointments.day }));
    expect(screen.getByTestId("address")).toHaveTextContent("view=day");

    await user.click(screen.getByRole("radio", { name: ar.appointments.week }));
    expect(screen.getByTestId("address").textContent).not.toContain("view=");
  });

  it("draws times in the clinic’s zone, not the browser’s", async () => {
    await renderCalendar(USER_ROLE.RECEPTIONIST, {
      "GET /clinic": {
        status: 200,
        body: { ...makeClinic(), settings: { timezone: "Asia/Tokyo" } },
      },
    });

    expect(await block(/7:00 PM/)).toBeInTheDocument();
    expect(
      within(await calendar()).queryByRole("button", { name: /\b10:00\b/ }),
    ).not.toBeInTheDocument();
  });

  it("only lets a real slot be picked in the booking form", async () => {
    await renderCalendar(USER_ROLE.RECEPTIONIST);

    await userEvent.click(await screen.findByRole("button", { name: ar.appointments.create }));

    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).queryAllByRole("radio")).toHaveLength(0);

    await choose(within(dialog).getByLabelText(ar.appointments.doctor), "د. ليلى حداد");

    const slots = await within(dialog).findAllByRole("radio");

    expect(slots.map((slot) => slot.textContent)).toEqual(["09:00", "09:30"]);

    expect(slots[0]).toBeEnabled();
    expect(slots[1]).toBeDisabled();
  });
});
