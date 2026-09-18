import { USER_ROLE } from "@clinic/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRoutes } from "@web/app/router";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

const profile = makeProfile({ role: USER_ROLE.DOCTOR, name: { ar: "رشا أبو عبيد", en: "Rasha" } });

const handlers = (overrides = {}) =>
  ({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: profile },
    "GET /clinic": { status: 200, body: makeClinic() },
    ...overrides,
  }) as Parameters<typeof mockApi>[0];

describe("My profile", () => {
  beforeEach(() => {
    authTokens.clear();
  });

  it("edits the reader’s own details through the one endpoint that writes their row", async () => {
    const api = mockApi(handlers({ "PATCH /me": { status: 200, body: profile } }));

    renderWithProviders(<AppRoutes />, { route: "/profile" });
    await screen.findByRole("heading", { name: ar.profile.title });

    await userEvent.click(screen.getByRole("button", { name: ar.profile.edit }));

    const dialog = await screen.findByRole("dialog");

    // Their role is the admin's to set, so it is not a field of this form.
    expect(within(dialog).queryByLabelText(ar.users.role)).not.toBeInTheDocument();

    const nameAr = within(dialog).getByLabelText(ar.users.nameAr);
    await userEvent.clear(nameAr);
    await userEvent.type(nameAr, "رشا أبو عبيد المحدّث");
    await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find((entry) => entry.method === "PATCH" && entry.url.endsWith("/me"));
      expect(call?.body).toMatchObject({ name: { ar: "رشا أبو عبيد المحدّث", en: "Rasha" } });
      expect(call?.body).not.toHaveProperty("role");
    });
  });
});
