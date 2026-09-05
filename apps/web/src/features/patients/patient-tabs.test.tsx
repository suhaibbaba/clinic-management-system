import { USER_ROLE } from '@clinic/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppRoutes } from '@web/app/router';
import ar from '@web/i18n/locales/ar.json';
import { authTokens } from '@web/lib/auth-tokens';
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
} from '@test/helpers/fixtures';
import { mockApi, renderWithProviders, type MockResponse } from '@test/helpers/render';

const CATALOG = makeCatalogItem();
const CROWN = makeCatalogItem({
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  code: 'CROWN-Z',
  nameAr: 'تاج زيركون',
  defaultPrice: '250.00',
  chartOutcome: 'crown',
});

function handlers(overrides: Record<string, MockResponse | unknown> = {}) {
  return {
    'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
    'GET /me': { status: 200, body: makeProfile({ role: USER_ROLE.DOCTOR }) },
    'GET /doctors': { status: 200, body: paginated([makeDoctor()]) },
    'GET /clinic': { status: 200, body: makeClinic() },
    'GET /patients': { status: 200, body: paginated([]) },
    [`GET /patients/${PATIENT_ID}`]: { status: 200, body: makePatient() },
    [`GET /patients/${PATIENT_ID}/allergy-flags`]: {
      status: 200,
      body: { patientId: PATIENT_ID, hasAllergies: false, allergies: [] },
    },
    'GET /procedure-catalog': { status: 200, body: paginated([CATALOG, CROWN]) },
    'GET /performed-procedures': { status: 200, body: paginated([]) },
    'GET /visits': { status: 200, body: paginated([]) },
    'GET /treatment-plans': { status: 200, body: paginated([]) },
    [`GET /patients/${PATIENT_ID}/attachments`]: { status: 200, body: paginated([]) },
    ...overrides,
  } as Record<string, MockResponse>;
}

async function openTab(tab: string, overrides = {}) {
  authTokens.clear();
  const api = mockApi(handlers(overrides));
  renderWithProviders(<AppRoutes />, { route: `/patients/${PATIENT_ID}` });
  await screen.findByRole('heading', { name: makePatient().fullName });
  await userEvent.click(screen.getByRole('tab', { name: tab }));
  return api;
}

describe('Visits tab', () => {
  beforeEach(() => authTokens.clear());

  it('lists each visit with its clinical fields', async () => {
    const visit = makeVisit();
    await openTab(ar.patients.tabs.visits, {
      'GET /visits': { status: 200, body: paginated([visit]) },
    });

    expect(await screen.findByText(visit.diagnosis!)).toBeInTheDocument();
    expect(screen.getByText(visit.complaint!)).toBeInTheDocument();
    expect(screen.getByText(visit.examination!)).toBeInTheDocument();
  });

  it('shows the procedures recorded during a visit under it', async () => {
    const visit = makeVisit();

    await openTab(ar.patients.tabs.visits, {
      'GET /visits': { status: 200, body: paginated([visit]) },
      'GET /performed-procedures': {
        status: 200,
        body: paginated([
          makeProcedure(46, { id: 'in-visit', visitId: visit.id, procedureId: CATALOG.id }),
          // Recorded outside any visit: belongs to the chart, not to a card here.
          makeProcedure(36, { id: 'loose', procedureId: CATALOG.id }),
        ]),
      },
    });

    await screen.findByText(visit.diagnosis!);

    expect(screen.getAllByText(CATALOG.nameAr)).toHaveLength(1);
    expect(screen.getByText('46')).toBeInTheDocument();
  });

  it('records a visit through the shared schema', async () => {
    const api = await openTab(ar.patients.tabs.visits, {
      'POST /visits': { status: 201, body: makeVisit() },
    });

    await userEvent.click(await screen.findByRole('button', { name: ar.visits.create }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(ar.visits.complaint), 'ألم');
    await userEvent.type(within(dialog).getByLabelText(ar.visits.diagnosis), 'نخر عاجي');
    await userEvent.click(within(dialog).getByRole('button', { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find(
        (entry) => entry.method === 'POST' && entry.url.endsWith('/visits'),
      );
      expect(call?.body).toMatchObject({ patientId: PATIENT_ID, diagnosis: 'نخر عاجي' });
      // The form collects local wall-clock time; the API is sent an instant.
      expect((call?.body as { visitDate: string }).visitDate).toMatch(/Z$/);
    });
  });

  it('records a procedure against the visit it happened in', async () => {
    const visit = makeVisit();
    const api = await openTab(ar.patients.tabs.visits, {
      'GET /visits': { status: 200, body: paginated([visit]) },
      'POST /performed-procedures': { status: 201, body: makeProcedure(46) },
    });

    await screen.findByText(visit.diagnosis!);
    await userEvent.click(screen.getByRole('button', { name: ar.chart.panel.addProcedure }));

    const form = screen.getByRole('combobox', { name: ar.chart.panel.procedure });
    await userEvent.selectOptions(form, CATALOG.id);
    await userEvent.click(screen.getByRole('button', { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find(
        (entry) => entry.method === 'POST' && entry.url.endsWith('/performed-procedures'),
      );
      expect(call?.body).toMatchObject({ patientId: PATIENT_ID, visitId: visit.id });
      // No tooth was named here, so nothing is charted.
      expect((call?.body as { chartMarks: unknown[] }).chartMarks).toEqual([]);
    });
  });
});

describe('Treatment plans tab', () => {
  beforeEach(() => authTokens.clear());

  const planWithItems = makeTreatmentPlan({
    items: [
      makePlanItem({ id: 'i1', estimatedPrice: '40.00', procedureId: CATALOG.id }),
      makePlanItem({
        id: 'i2',
        estimatedPrice: '250.00',
        procedureId: CROWN.id,
        sortOrder: 1,
        status: 'converted',
      }),
    ],
  });

  it('shows items in order with the quoted total', async () => {
    await openTab(ar.patients.tabs.treatmentPlans, {
      'GET /treatment-plans': { status: 200, body: paginated([planWithItems]) },
    });

    expect(await screen.findByText(planWithItems.title)).toBeInTheDocument();
    expect(screen.getByText(CATALOG.nameAr)).toBeInTheDocument();
    expect(screen.getByText(CROWN.nameAr)).toBeInTheDocument();
    // Quoted total is 40.00 + 250.00; only the still-planned item is remaining.
    // Scoped to the summary rows — 40.00 is also one item's own price.
    const total = screen.getByText(ar.treatmentPlans.total).closest('div');
    const remaining = screen.getByText(ar.treatmentPlans.remaining).closest('div');

    expect(within(total as HTMLElement).getByText(/290\.00/)).toBeInTheDocument();
    expect(within(remaining as HTMLElement).getByText(/40\.00/)).toBeInTheDocument();
  });

  it('converts an item through the existing endpoint', async () => {
    const api = await openTab(ar.patients.tabs.treatmentPlans, {
      'GET /treatment-plans': { status: 200, body: paginated([planWithItems]) },
      'POST /plan-items/i1/convert': { status: 201, body: makeProcedure(46) },
    });

    await screen.findByText(planWithItems.title);
    await userEvent.click(screen.getAllByRole('button', { name: ar.treatmentPlans.convert })[0]!);

    await waitFor(() => {
      expect(
        api.calls.some(
          (entry) => entry.method === 'POST' && entry.url.endsWith('/plan-items/i1/convert'),
        ),
      ).toBe(true);
    });
  });

  it('offers convert only on an item that is still planned', async () => {
    await openTab(ar.patients.tabs.treatmentPlans, {
      'GET /treatment-plans': {
        status: 200,
        body: paginated([
          makeTreatmentPlan({
            items: [makePlanItem({ id: 'done', status: 'converted', procedureId: CATALOG.id })],
          }),
        ]),
      },
    });

    await screen.findByText(CATALOG.nameAr);

    // Converting twice is refused by the API; the button is not offered at all.
    expect(
      screen.queryByRole('button', { name: ar.treatmentPlans.convert }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(ar.treatmentPlans.itemStatus.converted)).toBeInTheDocument();
  });

  it('renders the printable sheet on the clinic’s letterhead', async () => {
    await openTab(ar.patients.tabs.treatmentPlans, {
      'GET /treatment-plans': { status: 200, body: paginated([planWithItems]) },
    });

    await screen.findByText(planWithItems.title);
    await userEvent.click(screen.getByRole('button', { name: ar.treatmentPlans.print }));

    // Same data, one component: the sheet cannot drift from the screen.
    const heading = await screen.findByText(ar.treatmentPlans.printTitle);
    const sheet = heading.closest('.print-sheet');
    expect(sheet).not.toBeNull();

    expect(within(sheet as HTMLElement).getByText(makeClinic().name)).toBeInTheDocument();
    expect(within(sheet as HTMLElement).getByText(makePatient().fileNumber)).toBeInTheDocument();
    expect(
      within(sheet as HTMLElement).getByText(ar.treatmentPlans.signaturePatient),
    ).toBeInTheDocument();
  });
});

describe('Imaging tab', () => {
  beforeEach(() => authTokens.clear());

  it('lists images with their type and tooth', async () => {
    const attachment = makeAttachment();

    await openTab(ar.patients.tabs.attachments, {
      [`GET /patients/${PATIENT_ID}/attachments`]: { status: 200, body: paginated([attachment]) },
      [`GET /attachments/${attachment.id}`]: {
        status: 200,
        body: {
          ...attachment,
          downloadUrl: 'https://storage.test/signed',
          downloadUrlExpiresAt: '2026-02-01T09:05:00.000Z',
        },
      },
    });

    const caption = (await screen.findByText(attachment.filename)).closest('figcaption');
    expect(caption).not.toBeNull();

    // Scoped to the card: the type also appears in the filter and upload menus.
    expect(
      within(caption as HTMLElement).getByText(ar.imaging.types.xray_periapical),
    ).toBeInTheDocument();
    expect(within(caption as HTMLElement).getByText('46')).toBeInTheDocument();
  });

  it('asks for a signed URL per image rather than trusting the list', async () => {
    const attachment = makeAttachment();

    const api = await openTab(ar.patients.tabs.attachments, {
      [`GET /patients/${PATIENT_ID}/attachments`]: { status: 200, body: paginated([attachment]) },
      [`GET /attachments/${attachment.id}`]: {
        status: 200,
        body: { ...attachment, downloadUrl: 'https://storage.test/signed' },
      },
    });

    await screen.findByText(attachment.filename);

    await waitFor(() => {
      expect(api.calls.some((entry) => entry.url.includes(`/attachments/${attachment.id}`))).toBe(
        true,
      );
    });

    // The list response never carries a key or a URL.
    const listCall = api.calls.find((entry) => entry.url.includes('/attachments?'));
    expect(listCall).toBeDefined();
  });

  it('narrows the list by tooth, and refuses a number that is not a tooth', async () => {
    const api = await openTab(ar.patients.tabs.attachments);

    await userEvent.type(await screen.findByLabelText(ar.imaging.filterTooth), '46');

    await waitFor(() => {
      expect(api.calls.some((entry) => entry.url.includes('tooth=46'))).toBe(true);
    });

    await userEvent.clear(screen.getByLabelText(ar.imaging.filterTooth));
    await userEvent.type(screen.getByLabelText(ar.imaging.filterTooth), '49');

    expect(await screen.findByText(ar.imaging.invalidTooth)).toBeInTheDocument();
    expect(api.calls.some((entry) => entry.url.includes('tooth=49'))).toBe(false);
  });

  it('shows the empty state before anything is uploaded', async () => {
    await openTab(ar.patients.tabs.attachments);

    expect(await screen.findByText(ar.imaging.empty)).toBeInTheDocument();
  });
});
