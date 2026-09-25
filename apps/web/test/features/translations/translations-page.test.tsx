import { USER_ROLE } from "@clinic/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { TranslationsPage } from "@web/features/translations/translations-page";
import ar from "@web/i18n/locales/ar.json";
import en from "@web/i18n/locales/en.json";
import { authTokens } from "@web/lib/auth-tokens";
import { makeProfile } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type MockResponse } from "@test/helpers/render";

const flatten = (source: object, prefix = ""): Record<string, string> =>
  Object.entries(source).reduce<Record<string, string>>((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string"
      ? { ...out, [path]: value }
      : { ...out, ...flatten(value as object, path) };
  }, {});

const AR = flatten(ar);
const EN = flatten(en);

// Every key that ships as "الطبيب" / "Doctor" — one word, on several screens.
const DOCTOR_KEYS = Object.keys(AR).filter((key) => AR[key] === "الطبيب" && EN[key] === "Doctor");
const GROUP_ID = DOCTOR_KEYS[0] ?? "";

function renderPage(overrides: unknown[] = []) {
  authTokens.clear();
  const api = mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
    "GET /translations": { status: 200, body: { ar: {}, en: {} } },
    "GET /translations/overrides": { status: 200, body: overrides },
    "POST /translations/save": { status: 204, body: null },
  } as Record<string, MockResponse>);
  renderWithProviders(<TranslationsPage />);
  return api;
}

const findGroup = async (): Promise<HTMLElement> => {
  await userEvent.type(screen.getByRole("searchbox"), GROUP_ID);
  return screen.findByTestId(`translations-places-${GROUP_ID}`);
};

describe("Translations page", () => {
  beforeEach(() => authTokens.clear());

  it("lists identical wording once, with how many places use it", async () => {
    expect(DOCTOR_KEYS.length).toBeGreaterThan(1);
    renderPage();

    expect(await findGroup()).toHaveTextContent(new RegExp(String(DOCTOR_KEYS.length)));
  });

  it("writes one edit to every key that shares the wording", async () => {
    const api = renderPage();
    await findGroup();

    await userEvent.type(
      screen.getByTestId(`translations-ar-${GROUP_ID}-control`),
      "الطبيب المعالج",
    );
    await userEvent.click(screen.getByTestId("translations-save"));

    await waitFor(() => {
      const save = api.calls.find((call) => call.url.endsWith("/translations/save"));
      const items = (save?.body as { items: { language: string; key: string; value: string }[] })
        ?.items;

      expect(items?.map((item) => item.key).sort()).toEqual([...DOCTOR_KEYS].sort());
      expect(
        items?.every((item) => item.language === "ar" && item.value === "الطبيب المعالج"),
      ).toBe(true);
    });
  });

  it("opens onto its keys, so one place can be worded differently", async () => {
    const api = renderPage();
    const toggle = await findGroup();

    await userEvent.click(toggle);
    const second = DOCTOR_KEYS[1] ?? "";
    await userEvent.type(
      screen.getByTestId(`translations-en-${second}-only-control`),
      "Treating doctor",
    );
    await userEvent.click(screen.getByTestId("translations-save"));

    await waitFor(() => {
      const save = api.calls.find((call) => call.url.endsWith("/translations/save"));
      expect(save?.body).toEqual({
        items: [{ language: "en", key: second, value: "Treating doctor" }],
      });
    });
  });

  it("says so when the places no longer agree, instead of showing one of them", async () => {
    renderPage([
      {
        language: "ar",
        key: DOCTOR_KEYS[1],
        value: "الطبيب المعالج",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ]);
    await findGroup();

    const input = screen.getByTestId(`translations-ar-${GROUP_ID}-control`);
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", ar.translations.mixed);
  });
});
