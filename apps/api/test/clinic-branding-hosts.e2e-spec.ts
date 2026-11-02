import { randomUUID } from "node:crypto";
import { type ClinicBranding, type ClinicManifest } from "@clinic/shared";
import { eq } from "drizzle-orm";
import { clinics } from "@api/database/schema";
import { createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Branding on each clinic's dashboard domain (e2e)", () => {
  let context: TestContext;
  const clinicsAtHosts: { clinic: TestClinic; host: string; name: string; logoKey: string }[] = [];

  const at = (url: string, host: string) =>
    context.app.inject({ method: "GET", url, headers: { host } });

  beforeAll(async () => {
    context = await createTestContext();

    for (const label of ["first", "second"]) {
      const clinic = await context.createClinic();
      const host = `admin.${label}-${randomUUID().slice(0, 8)}.example.ps`;
      const name = `Clinic ${label} ${randomUUID().slice(0, 4)}`;
      const logoKey = `clinic/${clinic.id}/branding/${randomUUID()}-logo.png`;

      await context.db
        .update(clinics)
        .set({ appDomain: host, name: { ar: name, en: name }, logoKey, logoIconsAt: new Date() })
        .where(eq(clinics.id, clinic.id));
      clinicsAtHosts.push({ clinic, host, name, logoKey });
    }
  });

  afterAll(async () => {
    await context.close();
  });

  it("names and pictures the clinic whose dashboard domain was asked, beside another", async () => {
    for (const { host, name, logoKey } of clinicsAtHosts) {
      const branding = (await at("/clinic/branding", host)).json<ClinicBranding>();

      expect(branding.appName).toBe(name);
      expect(branding.logoUrl).toContain(logoKey);
      expect(branding.iconsAt).not.toBeNull();
    }
  });

  it("installs each clinic's app under its own name and icons", async () => {
    for (const { host, name, logoKey } of clinicsAtHosts) {
      const manifest = (await at("/clinic/manifest.webmanifest", host)).json<ClinicManifest>();
      const icon = await at("/clinic/icon/icon-192.png", host);

      expect(manifest.name).toBe(name);
      expect(manifest.icons.length).toBeGreaterThan(0);
      expect(icon.statusCode).toBe(302);
      expect(icon.headers["location"]).toContain(`${logoKey}/icons/icon-192.png`);
    }
  });

  it("brands no clinic on a host that is no clinic's, once there are several", async () => {
    const branding = (await at("/clinic/branding", "vendor.example.ps")).json<ClinicBranding>();

    expect(branding).toMatchObject({ name: null, logoUrl: null, appName: "" });
    expect((await at("/clinic/icon/icon-192.png", "vendor.example.ps")).statusCode).toBe(404);
  });
});
