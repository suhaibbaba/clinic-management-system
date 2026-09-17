import { USER_ROLE, type User } from "@clinic/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AppRoutes } from "@web/app/router";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import { makeProfile, makeUser, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";
import { choose } from "@test/select";

const admin = makeProfile();

function baseHandlers(users: User[]) {
  return {
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: admin },
    "GET /users": { status: 200, body: paginated(users) },
  };
}

async function renderUsersPage(users: User[]) {
  authTokens.clear();
  const api = mockApi(baseHandlers(users));
  renderWithProviders(<AppRoutes />, { route: "/users" });
  await screen.findByRole("heading", { name: ar.users.title });
  return api;
}

describe("Users management", () => {
  beforeEach(() => {
    authTokens.clear();
  });

  it("lists users with their role and status", async () => {
    const user = makeUser();
    await renderUsersPage([user]);

    // Scoped to the row: the role also appears in the filter's options.
    const row = (await screen.findByText(user.name.ar)).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row!).getByText(user.phone)).toBeInTheDocument();
    expect(within(row!).getByText(ar.roles.doctor)).toBeInTheDocument();
    expect(within(row!).getByText(ar.users.active)).toBeInTheDocument();
  });

  it("shows the empty state when the clinic has no users yet", async () => {
    await renderUsersPage([]);

    expect(await screen.findByText(ar.users.empty)).toBeInTheDocument();
  });

  it("creates a user and sends exactly what the form collected", async () => {
    authTokens.clear();
    const created = makeUser({
      name: { ar: "سامر خليل", en: "Samer Khalil" },
      phone: "+963100000009",
    });

    const api = mockApi({
      ...baseHandlers([]),
      "POST /users": { status: 201, body: created },
    });

    renderWithProviders(<AppRoutes />, { route: "/users" });
    await screen.findByRole("heading", { name: ar.users.title });

    await userEvent.click(screen.getAllByRole("button", { name: ar.users.create })[0]!);

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(ar.users.nameAr), created.name.ar);
    await userEvent.type(within(dialog).getByLabelText(ar.users.nameEn), created.name.en);
    await userEvent.type(within(dialog).getByLabelText(ar.users.phone), created.phone);
    await choose(within(dialog).getByLabelText(ar.users.role), ar.roles.receptionist);
    await userEvent.type(within(dialog).getByLabelText(ar.users.password), "NewUserPass123!");
    await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find(
        (entry) => entry.method === "POST" && entry.url.endsWith("/users"),
      );
      expect(call?.body).toMatchObject({
        name: created.name,
        phone: created.phone,
        role: USER_ROLE.RECEPTIONIST,
        password: "NewUserPass123!",
        isActive: true,
      });
      // The clinic is taken from the token; the client must never send one.
      expect(call?.body).not.toHaveProperty("clinicId");
    });
  });

  it("edits a user without touching the password", async () => {
    authTokens.clear();
    const user = makeUser();

    const api = mockApi({
      ...baseHandlers([user]),
      "PATCH /users/33333333-3333-4333-8333-333333333333": {
        status: 200,
        body: { ...user, name: { ar: "ليلى حداد المحدّث", en: "Layla Haddad (updated)" } },
      },
    });

    renderWithProviders(<AppRoutes />, { route: "/users" });
    await screen.findByText(user.name.ar);

    await userEvent.click(screen.getByRole("button", { name: ar.users.rowMenu }));
    await userEvent.click(await screen.findByRole("menuitem", { name: ar.common.edit }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText(ar.users.password)).not.toBeInTheDocument();

    const nameInput = within(dialog).getByLabelText(ar.users.nameAr);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "ليلى حداد المحدّث");
    await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find((entry) => entry.method === "PATCH");
      // The English spelling is untouched by editing the Arabic one; both go
      // up together, because the name is one value.
      expect(call?.body).toMatchObject({
        name: { ar: "ليلى حداد المحدّث", en: "Layla Haddad" },
      });
      expect(call?.body).not.toHaveProperty("password");
    });
  });

  it("deactivates a user from the table", async () => {
    authTokens.clear();
    const user = makeUser();

    const api = mockApi({
      ...baseHandlers([user]),
      "PATCH /users/33333333-3333-4333-8333-333333333333": {
        status: 200,
        body: { ...user, isActive: false },
      },
    });

    renderWithProviders(<AppRoutes />, { route: "/users" });
    await screen.findByText(user.name.ar);

    await userEvent.click(screen.getByRole("switch", { name: ar.users.deactivate }));

    await waitFor(() => {
      const call = api.calls.find((entry) => entry.method === "PATCH");
      expect(call?.body).toEqual({ isActive: false });
    });
  });

  it("sends a reset link rather than setting a password for an account with an address", async () => {
    authTokens.clear();
    const user = makeUser();

    const api = mockApi({
      ...baseHandlers([user]),
      "POST /users/33333333-3333-4333-8333-333333333333/send-password-reset": { status: 204 },
    });

    renderWithProviders(<AppRoutes />, { route: "/users" });
    await screen.findByText(user.name.ar);

    await userEvent.click(screen.getByRole("button", { name: ar.users.rowMenu }));

    // The password is the owner's to choose: no dialog asks the admin for one.
    expect(
      screen.queryByRole("menuitem", { name: ar.users.resetPassword }),
    ).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole("menuitem", { name: ar.users.sendResetLink }));

    await waitFor(() => {
      expect(
        api.calls.some(
          (entry) => entry.method === "POST" && entry.url.endsWith("/send-password-reset"),
        ),
      ).toBe(true);
    });
  });

  it("offers the activation letter, not a password change, while an account is unclaimed", async () => {
    authTokens.clear();
    const user = makeUser({ activated: false });

    mockApi(baseHandlers([user]));
    renderWithProviders(<AppRoutes />, { route: "/users" });
    await screen.findByText(user.name.ar);

    await userEvent.click(screen.getByRole("button", { name: ar.users.rowMenu }));

    expect(await screen.findByRole("menuitem", { name: ar.users.resendInvite })).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: ar.users.sendResetLink }),
    ).not.toBeInTheDocument();
  });

  it("sends no letter to a disabled account — the API refuses one either way", async () => {
    authTokens.clear();
    const user = makeUser({ isActive: false, activated: false });

    mockApi(baseHandlers([user]));
    renderWithProviders(<AppRoutes />, { route: "/users" });
    await screen.findByText(user.name.ar);

    await userEvent.click(screen.getByRole("button", { name: ar.users.rowMenu }));

    expect(await screen.findByRole("menuitem", { name: ar.common.edit })).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: ar.users.sendResetLink }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: ar.users.resendInvite })).not.toBeInTheDocument();
  });

  it("asks the admin for a password only where there is no address to send to", async () => {
    authTokens.clear();
    const user = makeUser({ email: null });

    const api = mockApi({
      ...baseHandlers([user]),
      "POST /users/33333333-3333-4333-8333-333333333333/reset-password": { status: 204 },
    });

    renderWithProviders(<AppRoutes />, { route: "/users" });
    await screen.findByText(user.name.ar);

    await userEvent.click(screen.getByRole("button", { name: ar.users.rowMenu }));
    await userEvent.click(await screen.findByRole("menuitem", { name: ar.users.resetPassword }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(ar.users.newPassword), "ResetByAdmin123!");
    await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find((entry) => entry.url.includes("/reset-password"));
      expect(call?.body).toEqual({ newPassword: "ResetByAdmin123!" });
    });
  });

  it("deletes an account from the row menu, once the question is answered", async () => {
    authTokens.clear();
    const user = makeUser();

    const api = mockApi({
      ...baseHandlers([user]),
      "DELETE /users/33333333-3333-4333-8333-333333333333": { status: 204 },
    });

    renderWithProviders(<AppRoutes />, { route: "/users" });
    await screen.findByText(user.name.ar);

    await userEvent.click(screen.getByRole("button", { name: ar.users.rowMenu }));
    await userEvent.click(await screen.findByRole("menuitem", { name: ar.users.delete }));

    const dialog = await screen.findByRole("dialog");

    expect(api.calls.some((entry) => entry.method === "DELETE")).toBe(false);

    await userEvent.click(within(dialog).getByRole("button", { name: ar.users.delete }));

    await waitFor(() => {
      expect(
        api.calls.some((entry) => entry.method === "DELETE" && entry.url.endsWith(user.id)),
      ).toBe(true);
    });
  });

  it("surfaces a duplicate phone number as an Arabic message", async () => {
    authTokens.clear();

    mockApi({
      ...baseHandlers([]),
      "POST /users": {
        status: 409,
        body: { statusCode: 409, message: "Phone number is already in use", error: "Conflict" },
      },
    });

    renderWithProviders(<AppRoutes />, { route: "/users" });
    await screen.findByRole("heading", { name: ar.users.title });

    await userEvent.click(screen.getAllByRole("button", { name: ar.users.create })[0]!);

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(ar.users.nameAr), "اسم مكرر");
    await userEvent.type(within(dialog).getByLabelText(ar.users.nameEn), "Duplicate name");
    await userEvent.type(within(dialog).getByLabelText(ar.users.phone), "+963100000002");
    await choose(within(dialog).getByLabelText(ar.users.role), ar.roles.doctor);
    await userEvent.type(within(dialog).getByLabelText(ar.users.password), "SomePassword123!");
    await userEvent.click(within(dialog).getByRole("button", { name: ar.common.save }));

    // Resolved from the status code, never from the backend's English text.
    expect(await screen.findByText(ar.errors.conflict)).toBeInTheDocument();
  });
});
