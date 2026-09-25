import { LOOKUP_LIST, SYSTEM_LOOKUPS, USER_ROLE, type UserRole } from "@clinic/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@web/app/router";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import {
  makeAttachment,
  makeCatalogItem,
  makeClinic,
  makeDoctor,
  makePatient,
  makePlanItem,
  makeProcedure,
  makeProfile,
  makeTreatmentPlan,
  makeVisit,
  paginated,
  PATIENT_ID,
} from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type MockResponse } from "@test/helpers/render";
import { choose } from "@test/select";

const CATALOG = makeCatalogItem();
const CROWN = makeCatalogItem({
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  code: "CROWN-Z",
  nameAr: "تاج زيركون",
  defaultPrice: "250.00",
  chartOutcome: "crown",
});

function handlers(overrides: Record<string, MockResponse | unknown> = {}) {
  return {
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.DOCTOR }) },
    "GET /doctors": { status: 200, body: paginated([makeDoctor()]) },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /patients": { status: 200, body: paginated([]) },
    [`GET /patients/${PATIENT_ID}`]: { status: 200, body: makePatient() },
    [`GET /patients/${PATIENT_ID}/allergy-flags`]: {
      status: 200,
      body: { patientId: PATIENT_ID, hasAllergies: false, allergies: [] },
    },
    "GET /procedure-catalog": { status: 200, body: paginated([CATALOG, CROWN]) },
    "GET /performed-procedures": { status: 200, body: paginated([]) },
    "GET /visits": { status: 200, body: paginated([]) },
    "GET /prescriptions": { status: 200, body: paginated([]) },
    "GET /treatment-plans": { status: 200, body: paginated([]) },
    [`GET /patients/${PATIENT_ID}/attachments`]: { status: 200, body: paginated([]) },
    ...overrides,
  } as Record<string, MockResponse>;
}

async function openTab(tab: string, overrides = {}) {
  authTokens.clear();
  const api = mockApi(handlers(overrides));
  renderWithProviders(<AppRoutes />, { route: `/patients/${PATIENT_ID}` });
  await screen.findByRole("heading", { name: makePatient().fullName });
  await userEvent.click(screen.getByRole("tab", { name: tab }));
  return api;
}

/** What the seeded `attachment_type` list calls a code, in Arabic. */
const attachmentTypeName = (code: string): string =>
  SYSTEM_LOOKUPS[LOOKUP_LIST.ATTACHMENT_TYPE].find((row) => row.code === code)?.nameAr ?? code;

describe("The file\u2019s tabs are addresses", () => {
  beforeEach(() => authTokens.clear());

  it("opens the tab the address names", async () => {
    authTokens.clear();
    mockApi(handlers());
    renderWithProviders(<AppRoutes />, { route: `/patients/${PATIENT_ID}?tab=visits` });

    await screen.findByRole("heading", { name: makePatient().fullName });

    expect(screen.getByRole("tab", { name: ar.patients.tabs.visits })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: ar.patients.tabs.chart })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("falls back to the first tab this role has, rather than a blank panel", async () => {
    // A receptionist's file is the account and nothing else, so a pasted
    // `?tab=chart` has to land on what they are allowed to open.
    authTokens.clear();
    mockApi(
      handlers({ "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.RECEPTIONIST }) } }),
    );
    renderWithProviders(<AppRoutes />, { route: `/patients/${PATIENT_ID}?tab=chart` });

    await screen.findByRole("heading", { name: makePatient().fullName });

    expect(screen.queryByRole("tab", { name: ar.patients.tabs.chart })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: ar.patients.tabs.billing })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

describe("Visits tab", () => {
  beforeEach(() => authTokens.clear());

  it("lists each visit with its clinical fields", async () => {
    const visit = makeVisit();
    await openTab(ar.patients.tabs.visits, {
      "GET /visits": { status: 200, body: paginated([visit]) },
    });

    expect(await screen.findByText(visit.diagnosis!)).toBeInTheDocument();
    expect(screen.getByText(visit.complaint!)).toBeInTheDocument();
    expect(screen.getByText(visit.examination!)).toBeInTheDocument();
  });

  it("shows the procedures recorded during a visit under it", async () => {
    const visit = makeVisit();

    await openTab(ar.patients.tabs.visits, {
      "GET /visits": { status: 200, body: paginated([visit]) },
      "GET /performed-procedures": {
        status: 200,
        body: paginated([
          makeProcedure(46, { id: "in-visit", visitId: visit.id, procedureId: CATALOG.id }),
          // Recorded outside any visit: belongs to the chart, not to a card here.
          makeProcedure(36, { id: "loose", procedureId: CATALOG.id }),
        ]),
      },
    });

    await screen.findByText(visit.diagnosis!);

    expect(screen.getAllByText(CATALOG.nameAr)).toHaveLength(1);
    expect(screen.getByText("46")).toBeInTheDocument();
  });

  it("records a visit through the shared schema", async () => {
    const api = await openTab(ar.patients.tabs.visits, {
      "POST /visits": { status: 201, body: makeVisit() },
    });

    await userEvent.click(await screen.findByRole("button", { name: ar.visits.create }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(ar.visits.complaint), "ألم");
    await userEvent.type(within(dialog).getByLabelText(ar.visits.diagnosis), "نخر عاجي");
    await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find(
        (entry) => entry.method === "POST" && entry.url.endsWith("/visits"),
      );
      expect(call?.body).toMatchObject({ patientId: PATIENT_ID, diagnosis: "نخر عاجي" });
      // The form collects local wall-clock time; the API is sent an instant.
      expect((call?.body as { visitDate: string }).visitDate).toMatch(/Z$/);
    });
  });

  it("records a procedure against the visit it happened in", async () => {
    const visit = makeVisit();
    const api = await openTab(ar.patients.tabs.visits, {
      "GET /visits": { status: 200, body: paginated([visit]) },
      "POST /performed-procedures": { status: 201, body: makeProcedure(46) },
    });

    await screen.findByText(visit.diagnosis!);
    await userEvent.click(screen.getByRole("button", { name: ar.chart.panel.addProcedure }));

    const form = screen.getByRole("combobox", { name: ar.chart.panel.procedure });
    await choose(form, CATALOG.nameAr);
    await userEvent.click(screen.getByRole("button", { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find(
        (entry) => entry.method === "POST" && entry.url.endsWith("/performed-procedures"),
      );
      expect(call?.body).toMatchObject({ patientId: PATIENT_ID, visitId: visit.id });
      // No tooth was named here, so nothing is charted.
      expect((call?.body as { chartMarks: unknown[] }).chartMarks).toEqual([]);
    });
  });
});

describe("Prescriptions tab", () => {
  beforeEach(() => authTokens.clear());

  it("keeps a drug and its duration against the visit, dose and frequency left out", async () => {
    const visit = makeVisit();
    const api = await openTab(ar.patients.tabs.prescriptions, {
      "GET /visits": { status: 200, body: paginated([visit]) },
      "POST /prescriptions": { status: 201, body: {} },
    });

    await userEvent.click(await screen.findByRole("button", { name: ar.prescriptions.create }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: ar.prescriptions.drug }),
      "مضاد التهاب",
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: ar.prescriptions.duration }),
      "5 أيام",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find(
        (entry) => entry.method === "POST" && entry.url.endsWith("/prescriptions"),
      );
      expect(call?.body).toMatchObject({
        patientId: PATIENT_ID,
        visitId: visit.id,
        doctorId: visit.doctorId,
        items: [{ drug: "مضاد التهاب", dose: null, frequency: null, duration: "5 أيام" }],
      });
    });
  });

  it("deletes a prescription only after the confirmation", async () => {
    const visit = makeVisit();
    const prescription = {
      id: "99999999-9999-4999-8999-999999999999",
      clinicId: visit.clinicId,
      patientId: PATIENT_ID,
      visitId: visit.id,
      doctorId: visit.doctorId,
      items: [{ drug: "مضاد التهاب", dose: null, frequency: null, duration: "5 أيام" }],
      notes: null,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
    };
    const api = await openTab(ar.patients.tabs.prescriptions, {
      "GET /visits": { status: 200, body: paginated([visit]) },
      "GET /prescriptions": { status: 200, body: paginated([prescription]) },
      [`DELETE /prescriptions/${prescription.id}`]: { status: 204 },
    });
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const deleteButton = await screen.findByRole("button", { name: ar.common.delete });
    const deletes = () => api.calls.filter((entry) => entry.method === "DELETE");

    await userEvent.click(deleteButton);
    expect(deletes()).toHaveLength(0);

    await userEvent.click(deleteButton);
    await waitFor(() => expect(deletes()).toHaveLength(1));

    confirm.mockRestore();
  });
});

describe("Treatment plans tab", () => {
  beforeEach(() => authTokens.clear());

  const planWithItems = makeTreatmentPlan({
    items: [
      makePlanItem({ id: "i1", estimatedPrice: "40.00", procedureId: CATALOG.id }),
      makePlanItem({
        id: "i2",
        estimatedPrice: "250.00",
        procedureId: CROWN.id,
        sortOrder: 1,
        status: "converted",
      }),
    ],
  });

  const plansResponse = { status: 200, body: paginated([planWithItems]) };

  const asRole = (role: UserRole) => ({
    "GET /me": { status: 200, body: makeProfile({ role }) },
  });

  const openItemMenu = async (itemId: string): Promise<void> => {
    const row = await screen.findByTestId(`treatment-plan-item-${itemId}`);
    await userEvent.click(within(row).getByRole("button", { name: ar.treatmentPlans.itemMenu }));
  };

  const openPlanMenu = async (): Promise<void> => {
    await userEvent.click(await screen.findByRole("button", { name: ar.treatmentPlans.menu }));
  };

  it("says what a plan is for", async () => {
    await openTab(ar.patients.tabs.treatmentPlans);

    expect(await screen.findByText(ar.treatmentPlans.about)).toBeInTheDocument();
  });

  it("shows items in order with the quoted total", async () => {
    await openTab(ar.patients.tabs.treatmentPlans, { "GET /treatment-plans": plansResponse });

    expect(await screen.findByText(planWithItems.title)).toBeInTheDocument();
    expect(screen.getByText(CATALOG.nameAr)).toBeInTheDocument();
    expect(screen.getByText(CROWN.nameAr)).toBeInTheDocument();
    // Quoted total is 40 + 250; only the still-planned item is remaining.
    const total = screen.getByText(ar.treatmentPlans.total).closest("div");
    const remaining = screen.getByText(ar.treatmentPlans.remaining).closest("div");

    expect(within(total as HTMLElement).getByText(/290/)).toBeInTheDocument();
    expect(within(remaining as HTMLElement).getByText(/40/)).toBeInTheDocument();
  });

  it("converts an item through the existing endpoint", async () => {
    const api = await openTab(ar.patients.tabs.treatmentPlans, {
      "GET /treatment-plans": plansResponse,
      "POST /plan-items/i1/convert": { status: 201, body: makeProcedure(46) },
    });

    await openItemMenu("i1");
    await userEvent.click(await screen.findByRole("menuitem", { name: ar.treatmentPlans.convert }));

    await waitFor(() => {
      expect(
        api.calls.some(
          (entry) => entry.method === "POST" && entry.url.endsWith("/plan-items/i1/convert"),
        ),
      ).toBe(true);
    });
  });

  it("offers no actions on an item that is no longer planned", async () => {
    await openTab(ar.patients.tabs.treatmentPlans, { "GET /treatment-plans": plansResponse });

    const converted = await screen.findByTestId("treatment-plan-item-i2");

    // Converting twice is refused by the API; the menu is not offered at all.
    expect(
      within(converted).queryByRole("button", { name: ar.treatmentPlans.itemMenu }),
    ).not.toBeInTheDocument();
    expect(within(converted).getByText(ar.treatmentPlans.itemStatus.converted)).toBeVisible();
  });

  it.each([
    [
      USER_ROLE.ADMIN,
      [ar.treatmentPlans.convert, ar.common.edit, ar.treatmentPlans.cancelItem, ar.common.delete],
    ],
    [USER_ROLE.DOCTOR, [ar.treatmentPlans.convert, ar.common.edit, ar.treatmentPlans.cancelItem]],
  ])("offers %s exactly its item actions", async (role, expected) => {
    await openTab(ar.patients.tabs.treatmentPlans, {
      ...asRole(role),
      "GET /treatment-plans": plansResponse,
    });

    await openItemMenu("i1");

    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(
      expected,
    );
  });

  it.each([
    [USER_ROLE.ADMIN, [ar.common.edit, ar.treatmentPlans.print, ar.common.delete]],
    [USER_ROLE.DOCTOR, [ar.common.edit, ar.treatmentPlans.print]],
  ])("offers %s exactly its plan actions", async (role, expected) => {
    await openTab(ar.patients.tabs.treatmentPlans, {
      ...asRole(role),
      "GET /treatment-plans": plansResponse,
    });

    await openPlanMenu();

    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(
      expected,
    );
  });

  it("creates a plan from the form with its name and doctor", async () => {
    const api = await openTab(ar.patients.tabs.treatmentPlans, {
      "POST /treatment-plans": { status: 201, body: makeTreatmentPlan() },
    });

    await userEvent.click(await screen.findByRole("button", { name: ar.treatmentPlans.create }));
    const dialog = await screen.findByRole("dialog");
    const title = within(dialog).getByLabelText(new RegExp(ar.treatmentPlans.title));

    expect(title).toHaveValue(ar.treatmentPlans.defaultTitle);
    await userEvent.clear(title);
    await userEvent.type(title, "ترميم الفك العلوي");
    await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => {
      const post = api.calls.find(
        (entry) => entry.method === "POST" && entry.url.endsWith("/treatment-plans"),
      );
      expect(post?.body).toMatchObject({
        patientId: PATIENT_ID,
        doctorId: makeDoctor().id,
        title: "ترميم الفك العلوي",
        status: "draft",
      });
    });
  });

  it("edits a plan in place", async () => {
    const api = await openTab(ar.patients.tabs.treatmentPlans, {
      "GET /treatment-plans": plansResponse,
      [`PATCH /treatment-plans/${planWithItems.id}`]: { status: 200, body: planWithItems },
    });

    await openPlanMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: ar.common.edit }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(new RegExp(ar.treatmentPlans.title))).toHaveValue(
      planWithItems.title,
    );
    await choose(
      within(dialog).getByLabelText(new RegExp(ar.treatmentPlans.status)),
      ar.treatmentPlans.planStatus.active,
    );
    await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => {
      const patch = api.calls.find((entry) => entry.method === "PATCH");
      expect(patch?.body).toMatchObject({ status: "active" });
    });
  });

  it("deletes a plan after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const api = await openTab(ar.patients.tabs.treatmentPlans, {
      ...asRole(USER_ROLE.ADMIN),
      "GET /treatment-plans": plansResponse,
      [`DELETE /treatment-plans/${planWithItems.id}`]: { status: 204, body: null },
    });

    await openPlanMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: ar.common.delete }));

    await waitFor(() =>
      expect(
        api.calls.some(
          (entry) =>
            entry.method === "DELETE" && entry.url.endsWith(`/treatment-plans/${planWithItems.id}`),
        ),
      ).toBe(true),
    );

    confirm.mockRestore();
  });

  it("adds an item with the doctor who will carry it out", async () => {
    const other = makeDoctor({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      user: { ...makeDoctor().user, name: { ar: "سامر خوري", en: "Samer Khoury" } },
    });
    const api = await openTab(ar.patients.tabs.treatmentPlans, {
      "GET /doctors": { status: 200, body: paginated([makeDoctor(), other]) },
      "GET /treatment-plans": plansResponse,
      [`POST /treatment-plans/${planWithItems.id}/items`]: { status: 201, body: makePlanItem() },
    });

    await userEvent.click(await screen.findByRole("button", { name: ar.treatmentPlans.addItem }));
    const dialog = await screen.findByRole("dialog");

    await choose(within(dialog).getByLabelText(new RegExp(ar.chart.panel.procedure)), CROWN.nameAr);
    await choose(
      within(dialog).getByLabelText(new RegExp(ar.treatmentPlans.performer)),
      other.user.name.ar,
    );
    await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => {
      const post = api.calls.find((entry) => entry.url.endsWith("/items"));
      expect(post?.body).toMatchObject({
        procedureId: CROWN.id,
        performerDoctorId: other.id,
        estimatedPrice: "250",
        sortOrder: 2,
      });
    });
  });

  it("adds a visiting doctor from the item form and makes them its performer", async () => {
    const visitor = makeDoctor({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      isVisiting: true,
      user: { ...makeDoctor().user, name: { ar: "رامي زائر", en: "Rami Visitor" } },
    });
    let doctors = [makeDoctor()];
    const api = await openTab(ar.patients.tabs.treatmentPlans, {
      "GET /doctors": () => ({ status: 200, body: paginated(doctors) }),
      "GET /treatment-plans": plansResponse,
      "POST /doctors/visiting": () => {
        doctors = [makeDoctor(), visitor];
        return { status: 201, body: visitor };
      },
      [`POST /treatment-plans/${planWithItems.id}/items`]: { status: 201, body: makePlanItem() },
    });

    await userEvent.click(await screen.findByRole("button", { name: ar.treatmentPlans.addItem }));
    const itemDialog = await screen.findByRole("dialog");
    await choose(
      within(itemDialog).getByLabelText(new RegExp(ar.chart.panel.procedure)),
      CROWN.nameAr,
    );
    await userEvent.click(
      within(itemDialog).getByRole("button", { name: ar.doctors.visiting.create }),
    );

    const visitorDialog = await screen.findByTestId("visiting-doctor-modal");
    const type = async (label: string, value: string) =>
      userEvent.type(within(visitorDialog).getByLabelText(label), value);
    await type(ar.users.firstNameAr, "رامي");
    await type(ar.users.lastNameAr, "زائر");
    await type(ar.users.firstNameEn, "Rami");
    await type(ar.users.lastNameEn, "Visitor");
    await type(ar.users.phone, "599123456");
    await userEvent.click(within(visitorDialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() =>
      expect(screen.queryByTestId("visiting-doctor-modal")).not.toBeInTheDocument(),
    );
    await userEvent.click(within(itemDialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => {
      const post = api.calls.find((entry) => entry.url.endsWith("/items"));
      expect(post?.body).toMatchObject({ performerDoctorId: visitor.id });
    });
  });

  it("renders the printable sheet on the clinic’s letterhead", async () => {
    await openTab(ar.patients.tabs.treatmentPlans, { "GET /treatment-plans": plansResponse });

    await openPlanMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: ar.treatmentPlans.print }));

    // Same data, one component: the sheet cannot drift from the screen.
    const heading = await screen.findByText(ar.treatmentPlans.printTitle);
    const sheet = heading.closest(".print-sheet");
    expect(sheet).not.toBeNull();

    expect(within(sheet as HTMLElement).getByText(makeClinic().name.ar)).toBeInTheDocument();
    expect(within(sheet as HTMLElement).getByText(makePatient().fileNumber)).toBeInTheDocument();
    expect(
      within(sheet as HTMLElement).getByText(ar.treatmentPlans.signaturePatient),
    ).toBeInTheDocument();
  });
});

describe("Imaging tab", () => {
  beforeEach(() => authTokens.clear());

  it("names each file and its date, with no type or tooth to read", async () => {
    const attachment = makeAttachment();

    await openTab(ar.patients.tabs.attachments, {
      [`GET /patients/${PATIENT_ID}/attachments`]: { status: 200, body: paginated([attachment]) },
      [`GET /attachments/${attachment.id}`]: {
        status: 200,
        body: {
          ...attachment,
          downloadUrl: "https://storage.test/signed",
          downloadUrlExpiresAt: "2026-02-01T09:05:00.000Z",
        },
      },
    });

    const caption = (await screen.findByText(attachment.filename)).closest("figcaption");
    expect(caption).not.toBeNull();

    expect(caption).toHaveTextContent(attachment.filename);
    expect(
      within(caption as HTMLElement).queryByText(attachmentTypeName("xray_periapical")),
    ).not.toBeInTheDocument();
    expect(within(caption as HTMLElement).queryByText("46")).not.toBeInTheDocument();
  });

  it("asks for a signed URL per image rather than trusting the list", async () => {
    const attachment = makeAttachment();

    const api = await openTab(ar.patients.tabs.attachments, {
      [`GET /patients/${PATIENT_ID}/attachments`]: { status: 200, body: paginated([attachment]) },
      [`GET /attachments/${attachment.id}`]: {
        status: 200,
        body: { ...attachment, downloadUrl: "https://storage.test/signed" },
      },
    });

    await screen.findByText(attachment.filename);

    await waitFor(() => {
      expect(api.calls.some((entry) => entry.url.includes(`/attachments/${attachment.id}`))).toBe(
        true,
      );
    });

    // The list response never carries a key or a URL.
    const listCall = api.calls.find((entry) => entry.url.includes("/attachments?"));
    expect(listCall).toBeDefined();
  });

  // The doctor reads what an image is by looking at it: nothing to fill in before a drop, and the
  // list is the patient's files, newest first, unfiltered.
  it("asks nothing before an upload and filters nothing", async () => {
    const api = await openTab(ar.patients.tabs.attachments);

    const tab = await screen.findByTestId("imaging-tab");
    expect(within(tab).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(tab).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(tab).getByTestId("imaging-upload-button")).toBeVisible();

    const list = api.calls.find((entry) => entry.url.includes("/attachments?"));
    expect(list?.url).not.toMatch(/[?&](type|tooth)=/);
  });

  it("shows the empty state before anything is uploaded", async () => {
    await openTab(ar.patients.tabs.attachments);

    expect(await screen.findByText(ar.imaging.empty)).toBeInTheDocument();
  });
});
