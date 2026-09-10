import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PageHeader } from '@web/components/ui/page-header';
import ar from '@web/i18n/locales/ar.json';
import { documentTitle } from '@web/lib/document-title';
import { makeProfile } from '@test/helpers/fixtures';
import { mockApi, renderWithProviders } from '@test/helpers/render';

const CLINIC = 'عيادة النور';

const profile = makeProfile({ clinic: { name: { ar: CLINIC, en: 'Al Nour' }, logoUrl: null } });

function renderRoutes(route: string) {
  mockApi({
    'POST /auth/refresh': { body: { accessToken: 'token', expiresIn: 900 } },
    'GET /me': { body: profile },
  });

  return renderWithProviders(
    <Routes>
      <Route
        path="/patients"
        element={
          <>
            <PageHeader title="patients.title" />
            <Link to="/inventory">go</Link>
          </>
        }
      />
      <Route path="/patients/:id" element={<h1>أحمد خالد</h1>} />
      <Route path="/inventory" element={<PageHeader title="inventory.title" />} />
    </Routes>,
    { route },
  );
}

describe('documentTitle', () => {
  it('joins the two halves, and copes with either alone', () => {
    expect(documentTitle('المرضى', CLINIC)).toBe(`المرضى — ${CLINIC}`);
    expect(documentTitle(undefined, CLINIC)).toBe(CLINIC);
    expect(documentTitle('المرضى', undefined)).toBe('المرضى');
    expect(documentTitle('المرضى', '')).toBe('المرضى');
  });
});

describe('the tab', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.title = '';
  });

  it('names the screen and the clinic once the session lands', async () => {
    renderRoutes('/patients');

    await waitFor(() => expect(document.title).toBe(`${ar.patients.title} — ${CLINIC}`));
  });

  it('follows a route change', async () => {
    renderRoutes('/patients');

    await waitFor(() => expect(document.title).toBe(`${ar.patients.title} — ${CLINIC}`));

    await userEvent.click(screen.getByRole('link', { name: 'go' }));

    await waitFor(() => expect(document.title).toBe(`${ar.inventory.title} — ${CLINIC}`));
  });

  // A patient's file has no i18n key for a heading — the name is data — so the route table names
  // it instead of the tab reading as the clinic alone.
  it('falls back to the route for a screen with no PageHeader', async () => {
    renderRoutes('/patients/abc');

    expect(await screen.findByText('أحمد خالد')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(`${ar.nav.patients} — ${CLINIC}`));
  });
});
