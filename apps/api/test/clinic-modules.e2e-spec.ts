import { USER_ROLE, type AuthenticatedUserProfile, type Permissions } from "@clinic/shared";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Paid modules (e2e)", () => {
  let context: TestContext;
  let without: TestClinic;
  let withAssistant: TestClinic;

  beforeAll(async () => {
    context = await createTestContext();
    without = await context.createClinic({ modules: [] });
    withAssistant = await context.createClinic();
  });

  afterAll(async () => {
    await context.close();
  });

  const as = async (clinic: TestClinic) =>
    auth(await context.login(clinic.phones[USER_ROLE.ADMIN]));

  it("closes the assistant's routes, even to the admin, while the module is off", async () => {
    const response = await context.app.inject({
      method: "GET",
      url: "/ai/conversations",
      headers: await as(without),
    });

    expect(response.statusCode).toBe(403);
  });

  it("opens them once the clinic has the module", async () => {
    const response = await context.app.inject({
      method: "GET",
      url: "/ai/conversations",
      headers: await as(withAssistant),
    });

    expect(response.statusCode).toBe(200);
  });

  it("leaves the assistant out of the session and the permissions page while it is off", async () => {
    const headers = await as(without);
    const me = await context.app.inject({ method: "GET", url: "/me", headers });
    const permissions = await context.app.inject({ method: "GET", url: "/permissions", headers });

    expect(me.json<AuthenticatedUserProfile>().capabilities).not.toContain("ai.chat");
    expect(
      permissions.json<Permissions>().capabilities.map((capability) => capability.key),
    ).not.toContain("ai.chat");
  });

  it("lists the assistant for a clinic that has it", async () => {
    const me = await context.app.inject({
      method: "GET",
      url: "/me",
      headers: await as(withAssistant),
    });

    expect(me.json<AuthenticatedUserProfile>().capabilities).toContain("ai.chat");
  });
});
