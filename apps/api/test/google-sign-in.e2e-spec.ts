import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { AUTH_ERROR, USER_ROLE, VENDOR_SECRET_KIND } from "@clinic/shared";
import { eq } from "drizzle-orm";
import { clinics, users } from "@api/database/schema";
import { SecretsService } from "@api/modules/secrets/services/secrets.service";
import { GOOGLE_STATE_COOKIE, GOOGLE_TOKEN_URL } from "@api/modules/auth/constants";
import { REFRESH_COOKIE_NAME } from "@api/modules/auth/lib/refresh-cookie";
import { createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const CLIENT_ID = "test-client.apps.googleusercontent.com";

function idToken(claims: Record<string, unknown>, aud = CLIENT_ID): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${part({ alg: "RS256" })}.${part({
    iss: "https://accounts.google.com",
    aud,
    exp: Math.floor(Date.now() / 1000) + 300,
    email_verified: true,
    ...claims,
  })}.signature`;
}

interface Cookie {
  name: string;
  value: string;
  maxAge?: number;
}

describe("Google sign-in (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let googleEnabled = true;
  let fetchSpy: jest.SpyInstance;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    const config = context.app.get(ConfigService);
    const read = config.get.bind(config);

    jest.spyOn(config, "get").mockImplementation(((key: string, options?: unknown) => {
      if (key === "GOOGLE_CLIENT_ID") {
        return googleEnabled ? CLIENT_ID : undefined;
      }

      if (key === "GOOGLE_CLIENT_SECRET") {
        return googleEnabled ? "test-secret" : undefined;
      }

      return read(key as never, options as never);
    }) as typeof config.get);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await context.close();
  });

  beforeEach(() => {
    googleEnabled = true;
    context.resetThrottle();
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const googleAnswers = (body: unknown, status = 200) =>
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );

  const start = async (query = "") => {
    const response = await context.app.inject({ method: "GET", url: `/auth/google${query}` });
    const location = new URL(response.headers.location as string);
    const cookie = (response.cookies as Cookie[]).find((c) => c.name === GOOGLE_STATE_COOKIE);

    return { response, location, cookie };
  };

  const callback = (query: string, cookie?: Cookie) =>
    context.app.inject({
      method: "GET",
      url: `/auth/google/callback?${query}`,
      ...(cookie && { cookies: { [cookie.name]: cookie.value } }),
    });

  const errorOf = (response: { headers: Record<string, unknown> }) =>
    new URL(response.headers["location"] as string).searchParams.get("error");

  it("says whether Google sign-in is offered", async () => {
    expect((await context.app.inject({ method: "GET", url: "/auth/methods" })).json()).toEqual({
      google: true,
    });

    googleEnabled = false;

    expect((await context.app.inject({ method: "GET", url: "/auth/methods" })).json()).toEqual({
      google: false,
    });
  });

  it("sends the browser to Google with state and PKCE", async () => {
    const { response, location, cookie } = await start();

    expect(response.statusCode).toBe(302);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost:5173/api/auth/google/callback",
    );
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(cookie?.value.split(".")[0]).toBe(location.searchParams.get("state"));
  });

  it("signs in the staff member whose email Google verified", async () => {
    const { location, cookie } = await start();
    const email = (
      await context.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, clinic.userIds[USER_ROLE.RECEPTIONIST]))
    )[0]?.email;
    googleAnswers({ id_token: idToken({ email: email?.toUpperCase() }) });

    const response = await callback(`code=abc&state=${location.searchParams.get("state")}`, cookie);

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("http://localhost:5173/");
    expect(
      (response.cookies as Cookie[]).some((c) => c.name === REFRESH_COOKIE_NAME && c.value),
    ).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0] as [string, { body: URLSearchParams }];
    expect(url).toBe(GOOGLE_TOKEN_URL);
    expect(init.body.get("code_verifier")).toBe(cookie?.value.split(".")[1]);
  });

  it("signs in for this browser session only when asked not to remember", async () => {
    const { location, cookie } = await start("?remember=0");
    const email = (
      await context.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, clinic.userIds[USER_ROLE.RECEPTIONIST]))
    )[0]?.email;
    googleAnswers({ id_token: idToken({ email }) });

    const response = await callback(`code=abc&state=${location.searchParams.get("state")}`, cookie);

    const refresh = (response.cookies as Cookie[]).find((c) => c.name === REFRESH_COOKIE_NAME);
    expect(refresh?.value).toBeTruthy();
    expect(refresh?.maxAge).toBeUndefined();
  });

  it("remembers the browser by default", async () => {
    const { location, cookie } = await start();
    const email = (
      await context.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, clinic.userIds[USER_ROLE.RECEPTIONIST]))
    )[0]?.email;
    googleAnswers({ id_token: idToken({ email }) });

    const response = await callback(`code=abc&state=${location.searchParams.get("state")}`, cookie);

    const refresh = (response.cookies as Cookie[]).find((c) => c.name === REFRESH_COOKIE_NAME);
    expect(refresh?.maxAge).toBeGreaterThan(0);
  });

  it("refuses a callback whose state does not match the browser's", async () => {
    const { cookie } = await start();

    const response = await callback("code=abc&state=forged", cookie);

    expect(errorOf(response)).toBe(AUTH_ERROR.GOOGLE_FAILED);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a callback with no state cookie", async () => {
    const { location } = await start();

    const response = await callback(`code=abc&state=${location.searchParams.get("state")}`);

    expect(errorOf(response)).toBe(AUTH_ERROR.GOOGLE_FAILED);
  });

  it("answers no account for an email nobody on staff has", async () => {
    const { location, cookie } = await start();
    googleAnswers({ id_token: idToken({ email: "stranger@example.com" }) });

    const response = await callback(`code=abc&state=${location.searchParams.get("state")}`, cookie);

    expect(errorOf(response)).toBe(AUTH_ERROR.GOOGLE_NO_ACCOUNT);
    expect((response.cookies as Cookie[]).some((c) => c.name === REFRESH_COOKIE_NAME)).toBe(false);
  });

  it("refuses an email Google has not verified", async () => {
    const { location, cookie } = await start();
    googleAnswers({
      id_token: idToken({ email: "admin@example.com", email_verified: false }),
    });

    const response = await callback(`code=abc&state=${location.searchParams.get("state")}`, cookie);

    expect(errorOf(response)).toBe(AUTH_ERROR.GOOGLE_FAILED);
  });

  it("refuses a token minted for another app", async () => {
    const { location, cookie } = await start();
    googleAnswers({ id_token: idToken({ email: "a@example.com", aud: "someone-else" }) });

    const response = await callback(`code=abc&state=${location.searchParams.get("state")}`, cookie);

    expect(errorOf(response)).toBe(AUTH_ERROR.GOOGLE_FAILED);
  });

  it("fails cleanly when Google refuses the code", async () => {
    const { location, cookie } = await start();
    googleAnswers({ error: "invalid_grant" }, 400);

    const response = await callback(`code=abc&state=${location.searchParams.get("state")}`, cookie);

    expect(errorOf(response)).toBe(AUTH_ERROR.GOOGLE_FAILED);
  });

  it("does not offer Google when it is not configured", async () => {
    googleEnabled = false;

    const response = await context.app.inject({ method: "GET", url: "/auth/google" });

    expect(response.statusCode).toBe(302);
    expect(errorOf(response)).toBe(AUTH_ERROR.GOOGLE_FAILED);
  });

  describe("a clinic's own Google app on its dashboard domain", () => {
    const CLINIC_CLIENT_ID = "clinic-own-client.apps.googleusercontent.com";
    let own: TestClinic;
    let host: string;

    const at = (url: string, cookie?: Cookie) =>
      context.app.inject({
        method: "GET",
        url,
        headers: { host },
        ...(cookie && { cookies: { [cookie.name]: cookie.value } }),
      });

    const emailOf = async (userId: string) =>
      (await context.db.select({ email: users.email }).from(users).where(eq(users.id, userId)))[0]
        ?.email;

    beforeAll(async () => {
      own = await context.createClinic();
      host = `admin.clinic-${randomUUID().slice(0, 8)}.example.ps`;

      await context.db
        .update(clinics)
        .set({ appDomain: host, googleClientId: CLINIC_CLIENT_ID })
        .where(eq(clinics.id, own.id));
      await context.app
        .get(SecretsService)
        .storeVendorSecret(
          context.db,
          own.id,
          VENDOR_SECRET_KIND.GOOGLE_CLIENT_SECRET,
          "clinic-own-secret",
        );
    });

    it("is offered on the clinic's host whether or not the server has a Google app", async () => {
      googleEnabled = false;

      expect((await at("/auth/methods")).json()).toEqual({ google: true });
    });

    it("sends the browser to Google with the clinic's client and a callback on its host", async () => {
      const response = await at("/auth/google");
      const location = new URL(response.headers.location as string);

      expect(location.searchParams.get("client_id")).toBe(CLINIC_CLIENT_ID);
      expect(location.searchParams.get("redirect_uri")).toBe(
        `http://${host}/api/auth/google/callback`,
      );
    });

    it("signs in the clinic's own staff and returns them to its host", async () => {
      const started = await at("/auth/google");
      const location = new URL(started.headers.location as string);
      const cookie = (started.cookies as Cookie[]).find((c) => c.name === GOOGLE_STATE_COOKIE);
      googleAnswers({
        id_token: idToken(
          { email: await emailOf(own.userIds[USER_ROLE.RECEPTIONIST]) },
          CLINIC_CLIENT_ID,
        ),
      });

      const response = await at(
        `/auth/google/callback?code=abc&state=${location.searchParams.get("state")}`,
        cookie,
      );

      expect(response.headers.location).toBe(`http://${host}/`);

      const [, init] = fetchSpy.mock.calls[0] as [string, { body: URLSearchParams }];
      expect(init.body.get("client_secret")).toBe("clinic-own-secret");
    });

    it("refuses staff of another clinic on this clinic's host", async () => {
      const started = await at("/auth/google");
      const location = new URL(started.headers.location as string);
      const cookie = (started.cookies as Cookie[]).find((c) => c.name === GOOGLE_STATE_COOKIE);
      googleAnswers({
        id_token: idToken(
          { email: await emailOf(clinic.userIds[USER_ROLE.RECEPTIONIST]) },
          CLINIC_CLIENT_ID,
        ),
      });

      const response = await at(
        `/auth/google/callback?code=abc&state=${location.searchParams.get("state")}`,
        cookie,
      );

      expect(errorOf(response)).toBe(AUTH_ERROR.GOOGLE_NO_ACCOUNT);
    });

    it("is not offered on a clinic's host without its own keys, even with the server's", async () => {
      const bare = await context.createClinic();
      const bareHost = `admin.bare-${randomUUID().slice(0, 8)}.example.ps`;
      await context.db.update(clinics).set({ appDomain: bareHost }).where(eq(clinics.id, bare.id));

      const response = await context.app.inject({
        method: "GET",
        url: "/auth/methods",
        headers: { host: bareHost },
      });

      expect(response.json()).toEqual({ google: false });
    });
  });
});
