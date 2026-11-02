import { randomUUID } from "node:crypto";
import { AUTH_ERROR, USER_ROLE } from "@clinic/shared";
import { eq } from "drizzle-orm";
import { clinics, passkeys, users } from "@api/database/schema";
import { REFRESH_COOKIE_NAME } from "@api/modules/auth/lib/refresh-cookie";
import { SoftAuthenticator } from "@test/helpers/soft-authenticator";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

interface Challenge {
  challengeId: string;
  options: { challenge: string; rpId?: string; rp?: { id: string } };
}

describe("Passkeys (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let token: string;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    token = await context.login(clinic.phones[USER_ROLE.DOCTOR]);
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(() => {
    context.resetThrottle();
  });

  const registrationOptions = async (accessToken = token): Promise<Challenge> =>
    (
      await context.app.inject({
        method: "POST",
        url: "/me/passkeys/options",
        headers: auth(accessToken),
      })
    ).json();

  const register = async (
    authenticator: SoftAuthenticator,
    accessToken = token,
    origin?: string,
  ) => {
    const { challengeId, options } = await registrationOptions(accessToken);

    return context.app.inject({
      method: "POST",
      url: "/me/passkeys",
      headers: auth(accessToken),
      payload: {
        challengeId,
        name: "Laptop",
        response: authenticator.register(options.challenge, origin),
      },
    });
  };

  const loginOptions = async (): Promise<Challenge> =>
    (await context.app.inject({ method: "POST", url: "/auth/passkey/options" })).json();

  const signIn = (challengeId: string, response: Record<string, unknown>) =>
    context.app.inject({
      method: "POST",
      url: "/auth/passkey/verify",
      payload: { challengeId, response },
    });

  it("binds the passkey to the site's host name", async () => {
    const { options } = await registrationOptions();

    expect(options.rp?.id).toBe("localhost");
  });

  it("registers a passkey and signs in with it", async () => {
    const authenticator = new SoftAuthenticator();
    const registered = await register(authenticator);

    expect(registered.statusCode).toBe(201);
    expect(registered.json()).toMatchObject({ name: "Laptop", lastUsedAt: null });

    const { challengeId, options } = await loginOptions();
    const response = await signIn(challengeId, authenticator.assert(options.challenge));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: { id: clinic.userIds[USER_ROLE.DOCTOR] },
    });
    expect(
      (response.cookies as { name: string }[]).some(
        (cookie) => cookie.name === REFRESH_COOKIE_NAME,
      ),
    ).toBe(true);

    const listed = await context.app.inject({
      method: "GET",
      url: "/me/passkeys",
      headers: auth(token),
    });
    const mine = (listed.json() as { id: string; lastUsedAt: string | null }[]).find(
      (passkey) => passkey.id === (registered.json() as { id: string }).id,
    );

    expect(mine?.lastUsedAt).not.toBeNull();
  });

  it("uses a sign-in challenge only once", async () => {
    const authenticator = new SoftAuthenticator();
    await register(authenticator);

    const { challengeId, options } = await loginOptions();

    expect((await signIn(challengeId, authenticator.assert(options.challenge))).statusCode).toBe(
      200,
    );

    const replayed = await signIn(challengeId, authenticator.assert(options.challenge));

    expect(replayed.statusCode).toBe(401);
    expect((replayed.json() as { message: string }).message).toBe(AUTH_ERROR.PASSKEY_INVALID);
  });

  it("refuses an assertion signed by another key", async () => {
    const authenticator = new SoftAuthenticator();
    await register(authenticator);

    const { challengeId, options } = await loginOptions();
    const forged = authenticator.assert(options.challenge, { signWith: new SoftAuthenticator() });

    expect((await signIn(challengeId, forged)).statusCode).toBe(401);
  });

  it("refuses an assertion made for another site", async () => {
    const authenticator = new SoftAuthenticator();
    await register(authenticator);

    const { challengeId, options } = await loginOptions();
    const elsewhere = authenticator.assert(options.challenge, { origin: "https://evil.test" });

    expect((await signIn(challengeId, elsewhere)).statusCode).toBe(401);
  });

  it("refuses a registration made for another site", async () => {
    const response = await register(new SoftAuthenticator(), token, "https://evil.test");

    expect(response.statusCode).toBe(400);
    expect((response.json() as { message: string }).message).toBe(AUTH_ERROR.PASSKEY_INVALID);
  });

  it("refuses a registration challenge issued to somebody else", async () => {
    const other = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);
    const { challengeId, options } = await registrationOptions(other);

    const response = await context.app.inject({
      method: "POST",
      url: "/me/passkeys",
      headers: auth(token),
      payload: {
        challengeId,
        name: "Stolen",
        response: new SoftAuthenticator().register(options.challenge),
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("stops signing in once the account is deactivated", async () => {
    const other = await context.createClinic();
    const accessToken = await context.login(other.phones[USER_ROLE.TECHNICIAN]);
    const authenticator = new SoftAuthenticator();
    await register(authenticator, accessToken);

    await context.db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, other.userIds[USER_ROLE.TECHNICIAN]));

    const { challengeId, options } = await loginOptions();

    expect((await signIn(challengeId, authenticator.assert(options.challenge))).statusCode).toBe(
      401,
    );
  });

  it("removes a passkey, which then no longer signs in", async () => {
    const authenticator = new SoftAuthenticator();
    const registered = await register(authenticator);
    const id = (registered.json() as { id: string }).id;

    const removed = await context.app.inject({
      method: "DELETE",
      url: `/me/passkeys/${id}`,
      headers: auth(token),
    });

    expect(removed.statusCode).toBe(204);

    const { challengeId, options } = await loginOptions();

    expect((await signIn(challengeId, authenticator.assert(options.challenge))).statusCode).toBe(
      401,
    );
  });

  it("answers 404 for somebody else's passkey, and keeps it", async () => {
    const registered = await register(new SoftAuthenticator());
    const id = (registered.json() as { id: string }).id;
    const other = await context.createClinic();
    const otherToken = await context.login(other.phones[USER_ROLE.ADMIN]);

    const response = await context.app.inject({
      method: "DELETE",
      url: `/me/passkeys/${id}`,
      headers: auth(otherToken),
    });

    expect(response.statusCode).toBe(404);
    expect(await context.db.select().from(passkeys).where(eq(passkeys.id, id))).toHaveLength(1);

    const listed = await context.app.inject({
      method: "GET",
      url: "/me/passkeys",
      headers: auth(otherToken),
    });

    expect(listed.json()).toEqual([]);
  });

  it("lists passkeys newest first", async () => {
    const other = await context.createClinic();
    const accessToken = await context.login(other.phones[USER_ROLE.RECEPTIONIST]);
    const first = (await register(new SoftAuthenticator(), accessToken)).json() as { id: string };
    const second = (await register(new SoftAuthenticator(), accessToken)).json() as { id: string };

    const listed = await context.app.inject({
      method: "GET",
      url: "/me/passkeys",
      headers: auth(accessToken),
    });

    expect((listed.json() as { id: string }[]).map((passkey) => passkey.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it("needs a signed-in user to manage passkeys", async () => {
    expect((await context.app.inject({ method: "GET", url: "/me/passkeys" })).statusCode).toBe(401);
  });

  it("binds a passkey made on a clinic's dashboard domain to that host", async () => {
    const host = `admin.passkey-${randomUUID().slice(0, 8)}.example.ps`;
    await context.db.update(clinics).set({ appDomain: host }).where(eq(clinics.id, clinic.id));

    const atHost = (url: string, headers: Record<string, string> = {}) =>
      context.app.inject({ method: "POST", url, headers: { ...headers, host } });

    const registration = (await atHost("/me/passkeys/options", auth(token))).json<Challenge>();
    const signIn = (await atHost("/auth/passkey/options")).json<Challenge>();
    const elsewhere = await loginOptions();

    expect(registration.options.rp?.id).toBe(host);
    expect(signIn.options.rpId).toBe(host);
    expect(elsewhere.options.rpId).toBe("localhost");

    await context.db.update(clinics).set({ appDomain: null }).where(eq(clinics.id, clinic.id));
  });
});
