import { LOOKUP_LIST, SYSTEM_LOOKUPS, USER_ROLE, type UserRole } from "@clinic/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRoutes } from "@web/app/router";
import { ageInYears } from "@web/features/patients/age";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import {
  makeBalance,
  makeCatalogItem,
  makeClinic,
  makeDoctor,
  makePatient,
  makeProcedure,
  makeProfile,
  makeStatement,
  makeToothHistory,
  paginated,
  PATIENT_ID,
  SHIPPED_CAPABILITIES,
} from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type MockResponse } from "@test/helpers/render";
import { choose } from "@test/select";

const CATALOG = makeCatalogItem();

function handlers(role: UserRole, overrides: Record<string, MockResponse | unknown> = {}) {
  return {
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role }) },
    "GET /doctors": { status: 200, body: paginated([makeDoctor()]) },
    "GET /patients": { status: 200, body: paginated([]) },
    [`GET /patients/${PATIENT_ID}`]: { status: 200, body: makePatient() },
    [`GET /patients/${PATIENT_ID}/allergy-flags`]: {
      status: 200,
      body: { patientId: PATIENT_ID, hasAllergies: true, allergies: ["البنسلين"] },
    },
    "GET /performed-procedures": {
      status: 200,
      body: paginated([makeProcedure(46, { procedureId: CATALOG.id })]),
    },
    "GET /procedure-catalog": { status: 200, body: paginated([CATALOG]) },
    "GET /clinic": { status: 200, body: makeClinic() },
    [`GET /patients/${PATIENT_ID}/balance`]: { status: 200, body: makeBalance() },
    [`GET /patients/${PATIENT_ID}/statement`]: { status: 200, body: makeStatement() },
    [`GET /patients/${PATIENT_ID}/teeth/46`]: { status: 200, body: makeToothHistory(46) },
    [`GET /patients/${PATIENT_ID}/teeth/16`]: {
      status: 200,
      body: makeToothHistory(16, { procedures: [], marks: [] }),
    },
    ...overrides,
  } as Record<string, MockResponse>;
}

async function renderPatientPage(role: UserRole, overrides = {}) {
  authTokens.clear();
  const api = mockApi(handlers(role, overrides));
  renderWithProviders(<AppRoutes />, { route: `/patients/${PATIENT_ID}` });
  return api;
}

/** A date of birth that is eight years old whenever the suite happens to run. */
function childDateOfBirth(): string {
  const born = new Date();
  born.setFullYear(born.getFullYear() - 8);

  return born.toISOString().slice(0, 10);
}

const toothButton = (fdi: number) =>
  screen.getByRole("button", { name: new RegExp(`\\b${fdi}\\b`) });

const findChart = () => screen.findByRole("group", { name: ar.chart.title });

// The drawer is a modal, so the chart behind it is correctly hidden from the accessibility tree and
// `getByRole` cannot see it.
const toothState = (fdi: number): string | null | undefined =>
  document.querySelector(`[data-tooth="${fdi}"]`)?.getAttribute("data-state");

/** What the seeded `tooth_state` list calls a code, in Arabic. */
const toothStateName = (code: string): string =>
  SYSTEM_LOOKUPS[LOOKUP_LIST.TOOTH_STATE].find((row) => row.code === code)?.nameAr ?? code;

describe("Patient page", () => {
  beforeEach(() => {
    authTokens.clear();
  });

  it("links to a WhatsApp chat on the patient's own number, else on their phone", async () => {
    await renderPatientPage(USER_ROLE.RECEPTIONIST, {
      [`GET /patients/${PATIENT_ID}`]: {
        status: 200,
        body: makePatient({ phone: "+970599123456" }),
      },
    });

    expect(await screen.findByRole("link", { name: ar.patients.chatOnWhatsapp })).toHaveAttribute(
      "href",
      "https://wa.me/970599123456",
    );
  });

  it("uses the WhatsApp number when the file has one", async () => {
    await renderPatientPage(USER_ROLE.RECEPTIONIST, {
      [`GET /patients/${PATIENT_ID}`]: {
        status: 200,
        body: makePatient({ phone: "+970599123456", whatsapp: "+972599123456" }),
      },
    });

    expect(await screen.findByRole("link", { name: ar.patients.chatOnWhatsapp })).toHaveAttribute(
      "href",
      "https://wa.me/972599123456",
    );
  });

  describe("route access (ROLES.md patients matrix)", () => {
    it.each([USER_ROLE.ADMIN, USER_ROLE.DOCTOR])("lets %s open the chart", async (role) => {
      await renderPatientPage(role);

      expect(await screen.findByRole("heading", { name: makePatient().fullName })).toBeVisible();
      expect(await findChart()).toBeInTheDocument();
    });

    it("redirects a technician away from the patient file", async () => {
      await renderPatientPage(USER_ROLE.TECHNICIAN);

      // The dashboard's `<h1>` is the banner's greeting; the day's panel names the screen.
      expect(
        await screen.findByRole("region", { name: ar.dashboard.schedule.title }),
      ).toBeVisible();

      expect(screen.queryByRole("group", { name: ar.chart.title })).not.toBeInTheDocument();
      expect(screen.queryByText(makePatient().fullName)).not.toBeInTheDocument();
    });

    // An external doctor treats; the clinic's accounts are not theirs to read.
    it("opens the clinical file for a visiting doctor without the account", async () => {
      await renderPatientPage(USER_ROLE.VISITING_DOCTOR);

      expect(await screen.findByRole("tab", { name: ar.patients.tabs.chart })).toBeVisible();
      expect(screen.getByRole("tab", { name: ar.patients.tabs.treatmentPlans })).toBeVisible();
      expect(screen.queryByRole("tab", { name: ar.patients.tabs.billing })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: ar.patients.rowMenu })).not.toBeInTheDocument();
    });

    it("opens the file for a receptionist with the account tab only", async () => {
      await renderPatientPage(USER_ROLE.RECEPTIONIST);

      // Taking payments is their job, so they reach the file — but the clinical
      // tabs are not theirs, and the API would refuse them anyway.
      expect(await screen.findByRole("tab", { name: ar.patients.tabs.billing })).toBeVisible();
      expect(screen.queryByRole("tab", { name: ar.patients.tabs.chart })).not.toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: ar.patients.tabs.visits })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("tab", { name: ar.patients.tabs.attachments }),
      ).not.toBeInTheDocument();
    });
  });

  // ROLES.md, patients: basic info is CRUD for an admin and CRU for a doctor and a receptionist.
  // The endpoint existed from the start; the screen to reach it did not, so nobody could correct a
  // misspelt name — an admin least of all, which is how it was noticed.
  describe("editing the file (ROLES.md patients matrix)", () => {
    const openMenu = async (): Promise<void> => {
      await userEvent.click(await screen.findByRole("button", { name: ar.patients.rowMenu }));
    };

    // The header carries one menu rather than a row of buttons; delete is admin-only until the
    // permissions page grants it to someone else.
    it.each([
      [USER_ROLE.ADMIN, [ar.patients.edit, ar.common.delete]],
      [USER_ROLE.DOCTOR, [ar.patients.edit]],
      [USER_ROLE.RECEPTIONIST, [ar.patients.edit]],
    ])("offers %s exactly its file actions", async (role, expected) => {
      await renderPatientPage(role);
      await openMenu();

      expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(
        expected,
      );
    });

    it("offers delete to a doctor the clinic has granted it", async () => {
      await renderPatientPage(USER_ROLE.DOCTOR, {
        "GET /me": {
          status: 200,
          body: makeProfile({
            role: USER_ROLE.DOCTOR,
            capabilities: [...SHIPPED_CAPABILITIES[USER_ROLE.DOCTOR], "patients.remove"],
          }),
        },
      });
      await openMenu();

      expect(await screen.findByRole("menuitem", { name: ar.common.delete })).toBeInTheDocument();
    });

    it("deletes the file after confirmation and returns to the list", async () => {
      const api = await renderPatientPage(USER_ROLE.ADMIN, {
        [`DELETE /patients/${PATIENT_ID}`]: { status: 204, body: null },
      });
      await openMenu();
      await userEvent.click(await screen.findByRole("menuitem", { name: ar.common.delete }));
      await userEvent.click(await screen.findByRole("button", { name: ar.common.deleteForever }));

      await waitFor(() =>
        expect(
          api.calls.some((call) => call.method === "DELETE" && call.url.endsWith(PATIENT_ID)),
        ).toBe(true),
      );
      expect(await screen.findByTestId("patients-page")).toBeInTheDocument();
    });

    it("opens the form on the record it is editing, not an empty one", async () => {
      const user = userEvent.setup();
      await renderPatientPage(USER_ROLE.ADMIN);

      await user.click(await screen.findByRole("button", { name: ar.patients.rowMenu }));
      await user.click(await screen.findByRole("menuitem", { name: ar.patients.edit }));

      expect(await screen.findByLabelText(ar.patients.firstName)).toHaveValue(
        makePatient().firstName,
      );
      expect(screen.getByLabelText(ar.patients.lastName)).toHaveValue(makePatient().lastName);
    });

    it("names what an incomplete file is missing, where the badge only says it is", async () => {
      const user = userEvent.setup();
      await renderPatientPage(USER_ROLE.ADMIN, {
        [`GET /patients/${PATIENT_ID}`]: {
          status: 200,
          body: makePatient({ dateOfBirth: null, profileIncomplete: true }),
        },
      });

      await user.click(await screen.findByRole("button", { name: ar.patients.rowMenu }));
      await user.click(await screen.findByRole("menuitem", { name: ar.patients.edit }));

      const notice = await screen.findByTestId("patient-edit-modal-incomplete");
      expect(notice).toHaveTextContent(ar.patients.dateOfBirth);
      expect(notice).not.toHaveTextContent(ar.patients.gender);
      expect(screen.getByText(ar.patients.neededToComplete)).toBeInTheDocument();
    });
  });

  describe("booking from the file (ROLES.md appointments matrix)", () => {
    it.each([USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST])(
      "offers %s a new appointment",
      async (role) => {
        await renderPatientPage(role);

        expect(
          await screen.findByRole("button", { name: ar.appointments.create }),
        ).toBeInTheDocument();
      },
    );

    it("opens the form on the patient whose file is open, with no search to do", async () => {
      await renderPatientPage(USER_ROLE.RECEPTIONIST);

      await userEvent.click(await screen.findByRole("button", { name: ar.appointments.create }));

      const form = await screen.findByRole("dialog");

      // The patient is settled, so the picker shows the chosen card rather than a search box.
      expect(within(form).getByText(makePatient().fullName)).toBeInTheDocument();
      expect(within(form).queryByRole("combobox", { name: ar.patients.search })).toBeNull();
    });
  });

  describe("header", () => {
    it("shows the file number, age and phone", async () => {
      await renderPatientPage(USER_ROLE.DOCTOR);

      expect(await screen.findByText("00001")).toBeInTheDocument();
      expect(screen.getByText("+963931000001")).toBeInTheDocument();
    });

    it("shows the balance the ledger computed", async () => {
      await renderPatientPage(USER_ROLE.DOCTOR);

      // `Money` nests its LTR island inside the coloured box, so both spans carry the same text.
      // The outermost is the one asserted on.
      const boxes = await screen.findAllByText(
        (_text, element) => element?.textContent?.replace(/\s/g, " ") === "100 $",
        { selector: "span" },
      );

      expect(boxes[0]).toBeInTheDocument();
    });

    it("computes whole years, not part ones", () => {
      const now = new Date("2026-03-13T00:00:00Z");

      // The day before the birthday is still the previous year of age.
      expect(ageInYears("1988-03-14", now)).toBe(37);
      expect(ageInYears("1988-03-13", now)).toBe(38);
    });
  });

  describe("allergy banner", () => {
    it("is announced and shown above everything else", async () => {
      await renderPatientPage(USER_ROLE.DOCTOR);

      const banner = await screen.findByRole("alert");
      expect(within(banner).getByText("البنسلين")).toBeInTheDocument();
    });

    it("is absent when the patient has no allergies", async () => {
      await renderPatientPage(USER_ROLE.DOCTOR, {
        [`GET /patients/${PATIENT_ID}/allergy-flags`]: {
          status: 200,
          body: { patientId: PATIENT_ID, hasAllergies: false, allergies: [] },
        },
      });

      await findChart();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("chart", () => {
    it("colours a tooth from the procedures the API returned", async () => {
      await renderPatientPage(USER_ROLE.DOCTOR);

      const tooth = await screen.findByRole("button", {
        name: new RegExp(`46 — ${toothStateName("filling")}`),
      });

      expect(tooth).toHaveAttribute("data-state", "filling");
    });

    it("switches between adult and child dentition for a child", async () => {
      await renderPatientPage(USER_ROLE.DOCTOR, {
        [`GET /patients/${PATIENT_ID}`]: {
          status: 200,
          body: makePatient({ dateOfBirth: childDateOfBirth() }),
        },
      });
      await findChart();

      // The dentition switch is a radio group: one of two, exactly one chosen.
      await userEvent.click(screen.getByRole("radio", { name: ar.chart.deciduous }));

      expect(await screen.findByRole("button", { name: /\b55\b/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /\b18\b/ })).not.toBeInTheDocument();
    });

    it("does not offer a baby-teeth chart for an adult", async () => {
      // The fixture patient was born in 1988; nobody needs to be asked whether
      // to chart their deciduous arch.
      await renderPatientPage(USER_ROLE.DOCTOR);
      await findChart();

      expect(screen.queryByRole("radio", { name: ar.chart.deciduous })).not.toBeInTheDocument();
    });

    it("keeps the switch for an adult who has a deciduous tooth on file", async () => {
      // A retained deciduous tooth is rare and real, and the chart must never
      // become unable to show a tooth it holds a procedure for.
      await renderPatientPage(USER_ROLE.DOCTOR, {
        "GET /performed-procedures": {
          status: 200,
          body: paginated([makeProcedure(55, { procedureId: CATALOG.id })]),
        },
      });
      await findChart();

      expect(screen.getByRole("radio", { name: ar.chart.deciduous })).toBeInTheDocument();
    });

    it("opens the panel with that tooth’s history", async () => {
      await renderPatientPage(USER_ROLE.DOCTOR);
      await findChart();

      await userEvent.click(toothButton(46));

      const panel = await screen.findByRole("dialog");
      expect(within(panel).getByText(CATALOG.name)).toBeInTheDocument();
      // ROLES.md billing: a doctor reads charges, so the price is shown — as
      // every figure in this app is, through `<Money>`: whole, with a symbol.
      // The figure and its symbol share one island now, so there is no element whose text is bare
      // "60"; the box that holds both is what is asserted on.
      expect(
        within(panel).getAllByText((_text, element) => /^60\s/.test(element?.textContent ?? ""))[0],
      ).toBeInTheDocument();
    });
  });

  describe("recording a procedure", () => {
    async function openAddForm() {
      await findChart();
      await userEvent.click(toothButton(16));
      await screen.findByRole("dialog");
      await userEvent.click(screen.getByRole("button", { name: ar.chart.panel.addProcedure }));
    }

    async function submitProcedure() {
      const dialog = screen.getByRole("dialog");
      await choose(within(dialog).getByLabelText(ar.chart.panel.procedure), CATALOG.name);
      await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));
    }

    it("recolours the tooth and sends what the form collected", async () => {
      // The server only knows about tooth 16 once the write has landed, so the
      // list reads differently before and after — as it would in production.
      let recorded = false;

      const api = await renderPatientPage(USER_ROLE.DOCTOR, {
        "POST /performed-procedures": () => {
          recorded = true;
          return {
            status: 201,
            body: makeProcedure(16, { id: "created", procedureId: CATALOG.id }),
          };
        },
        "GET /performed-procedures": () => ({
          status: 200,
          body: paginated([
            makeProcedure(46, { procedureId: CATALOG.id }),
            ...(recorded ? [makeProcedure(16, { id: "created", procedureId: CATALOG.id })] : []),
          ]),
        }),
      });

      await openAddForm();
      expect(toothState(16)).toBe("healthy");

      await submitProcedure();

      await waitFor(() => {
        expect(toothState(16)).toBe("filling");
      });

      const call = api.calls.find(
        (entry) => entry.method === "POST" && entry.url.endsWith("/performed-procedures"),
      );
      expect(call?.body).toMatchObject({
        patientId: PATIENT_ID,
        procedureId: CATALOG.id,
        chartMarks: [{ chartType: "tooth_fdi", location: { tooth: 16 } }],
      });
    });

    it("puts the tooth back when the API refuses the write", async () => {
      await renderPatientPage(USER_ROLE.DOCTOR, {
        "POST /performed-procedures": { status: 400, body: { statusCode: 400 } },
      });

      await openAddForm();
      expect(toothState(16)).toBe("healthy");

      await submitProcedure();

      // The failure is reported, and the tooth never keeps a colour it did not
      // earn: the optimistic entry is rolled back rather than left on screen.
      expect(await screen.findByText(ar.errors.badRequest)).toBeInTheDocument();
      await waitFor(() => {
        expect(toothState(16)).toBe("healthy");
      });
    });

    it("refuses to submit a discount without a reason", async () => {
      await renderPatientPage(USER_ROLE.DOCTOR);
      await openAddForm();

      const dialog = screen.getByRole("dialog");
      await choose(within(dialog).getByLabelText(ar.chart.panel.procedure), CATALOG.name);
      // The label carries an "(optional)" suffix, hence the loose match.
      await userEvent.type(
        within(dialog).getByLabelText(ar.chart.panel.discount, { exact: false }),
        "10.00",
      );
      await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

      expect(
        await within(dialog).findByText(ar.chart.panel.discountNeedsReason),
      ).toBeInTheDocument();
    });
  });
});
