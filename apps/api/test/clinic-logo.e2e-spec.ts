import {
  MAX_CLINIC_LOGO_BYTES,
  USER_ROLE,
  type Clinic,
  type ClinicBranding,
  type PresignClinicLogoResponse,
  type UserRole,
} from '@clinic/shared';

import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';
import { StorageService, type StoredObject } from '@api/storage/storage.service';

describe('Clinic logo (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let storage: StorageService;
  const tokens = {} as Record<UserRole, string>;

  let storedObject: StoredObject | null;
  let deleted: string[];

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of Object.values(USER_ROLE)) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    // Signing is offline; only the read-back of a stored object and the
    // cleanup delete need a stand-in.
    storage = context.app.get(StorageService);
    storage.statObject = async (): Promise<StoredObject | null> => storedObject;
    storage.deleteObject = async (key: string): Promise<void> => {
      deleted.push(key);
    };
  });

  beforeEach(() => {
    storedObject = { sizeBytes: 40_000, mime: 'image/png' };
    deleted = [];
  });

  afterAll(async () => {
    await context.close();
  });

  const asAdmin = () => auth(tokens[USER_ROLE.ADMIN]);

  const presign = async (payload: Record<string, unknown> = {}) =>
    context.app.inject({
      method: 'POST',
      url: '/clinic/logo/presign',
      headers: asAdmin(),
      payload: { filename: 'logo.png', mime: 'image/png', sizeBytes: 40_000, ...payload },
    });

  const confirm = async (key: string, token = tokens[USER_ROLE.ADMIN]) =>
    context.app.inject({
      method: 'POST',
      url: '/clinic/logo',
      headers: auth(token),
      payload: { key },
    });

  describe('the happy path', () => {
    it('signs an upload, records the key, and hands back a URL to draw it with', async () => {
      const signed = await presign();
      expect(signed.statusCode).toBe(200);

      const upload = signed.json() as PresignClinicLogoResponse;
      expect(upload.maxSizeBytes).toBe(MAX_CLINIC_LOGO_BYTES);
      // The key is the API's, built from the caller's own clinic — never the
      // client's, and never inside a patient's folder.
      expect(upload.key).toMatch(new RegExp(`^clinic/${clinic.id}/branding/`));
      expect(upload.uploadUrl).toContain(upload.key);

      const confirmed = await confirm(upload.key);
      expect(confirmed.statusCode).toBe(200);

      const body = confirmed.json() as Clinic;
      expect(body.logoKey).toBe(upload.key);
      expect(body.logoUrl).toContain(upload.key);

      // And it is there on the next read, for the sidebar to draw.
      const read = await context.app.inject({ method: 'GET', url: '/clinic', headers: asAdmin() });
      expect((read.json() as Clinic).logoUrl).toContain(upload.key);
    });

    it('drops the image it replaces — a logo is one current mark, not a history', async () => {
      const first = ((await presign()).json() as PresignClinicLogoResponse).key;
      await confirm(first);

      const second = ((await presign()).json() as PresignClinicLogoResponse).key;
      deleted = [];
      await confirm(second);

      expect(deleted).toEqual([first]);
    });

    it('goes back to the generated mark, and takes the object with it', async () => {
      const key = ((await presign()).json() as PresignClinicLogoResponse).key;
      await confirm(key);
      deleted = [];

      const response = await context.app.inject({
        method: 'DELETE',
        url: '/clinic/logo',
        headers: asAdmin(),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ logoKey: null, logoUrl: null });
      expect(deleted).toEqual([key]);
    });
  });

  describe('what it refuses', () => {
    it('refuses a file that is not an image, before signing anything', async () => {
      const response = await presign({ filename: 'logo.pdf', mime: 'application/pdf' });

      expect(response.statusCode).toBe(400);
    });

    it('refuses one over the ceiling, before signing anything', async () => {
      const response = await presign({ sizeBytes: MAX_CLINIC_LOGO_BYTES + 1 });

      expect(response.statusCode).toBe(400);
    });

    // The claim in the request body is not the file: what is checked on confirm is what the bytes
    // turned out to be.
    it('refuses bytes that turned out not to be an image, and deletes them', async () => {
      const key = ((await presign()).json() as PresignClinicLogoResponse).key;
      storedObject = { sizeBytes: 40_000, mime: 'application/zip' };

      const response = await confirm(key);

      expect(response.statusCode).toBe(400);
      expect(deleted).toEqual([key]);
    });

    it('refuses bytes that turned out to be too big, and deletes them', async () => {
      const key = ((await presign()).json() as PresignClinicLogoResponse).key;
      storedObject = { sizeBytes: MAX_CLINIC_LOGO_BYTES + 1, mime: 'image/png' };

      const response = await confirm(key);

      expect(response.statusCode).toBe(400);
      expect(deleted).toEqual([key]);
    });

    it('refuses a key that was never uploaded to', async () => {
      const key = ((await presign()).json() as PresignClinicLogoResponse).key;
      storedObject = null;

      expect((await confirm(key)).statusCode).toBe(400);
    });

    it('refuses a key belonging to another clinic', async () => {
      const other = await context.createClinic();

      const response = await confirm(`clinic/${other.id}/branding/whatever.png`);

      expect(response.statusCode).toBe(400);
    });

    /* A patient's X-ray is not the clinic's letterhead. */
    it('refuses a key from inside a patient folder', async () => {
      const response = await confirm(`clinic/${clinic.id}/patients/x/xray_panoramic/scan.png`);

      expect(response.statusCode).toBe(400);
    });
  });

  describe("permissions (ROLES.md: clinic settings are the admin's)", () => {
    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      'refuses %s the upload',
      async (role) => {
        const response = await context.app.inject({
          method: 'POST',
          url: '/clinic/logo/presign',
          headers: auth(tokens[role]),
          payload: { filename: 'logo.png', mime: 'image/png', sizeBytes: 40_000 },
        });

        expect(response.statusCode).toBe(403);
      },
    );

    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      'refuses %s the removal',
      async (role) => {
        const response = await context.app.inject({
          method: 'DELETE',
          url: '/clinic/logo',
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(403);
      },
    );

    /* Every role draws the sidebar, so every role reads the logo. */
    it('lets every signed-in role read it', async () => {
      const key = ((await presign()).json() as PresignClinicLogoResponse).key;
      await confirm(key);

      for (const role of Object.values(USER_ROLE)) {
        const response = await context.app.inject({
          method: 'GET',
          url: '/clinic',
          headers: auth(tokens[role]),
        });

        expect((response.json() as Clinic).logoUrl).toContain(key);
      }
    });
  });

  /** Public because the sign-in screen has no token, and quiet unless the answer is a single clinic. */
  describe('the sign-in screen', () => {
    it('answers without a token', async () => {
      const response = await context.app.inject({ method: 'GET', url: '/clinic/branding' });

      expect(response.statusCode).toBe(200);
      expect(Object.keys(response.json() as ClinicBranding).sort()).toEqual(['logoUrl', 'name']);
    });

    it('names no clinic when the deployment serves several', async () => {
      const response = await context.app.inject({ method: 'GET', url: '/clinic/branding' });

      expect(response.json()).toEqual({ name: null, logoUrl: null });
    });
  });

  // A logo is not medical data, and a URL that changed on every response is a URL no browser could
  // ever reuse — which is the whole reason the rail used to flash on every page.
  describe('a URL a browser can cache', () => {
    const logoUrl = async (): Promise<string> => {
      const read = await context.app.inject({ method: 'GET', url: '/clinic', headers: asAdmin() });

      return (read.json() as Clinic).logoUrl ?? '';
    };

    beforeAll(async () => {
      const key = ((await presign()).json() as PresignClinicLogoResponse).key;
      await confirm(key);
    });

    it('hands out the same URL byte for byte on every read', async () => {
      expect(await logoUrl()).toBe(await logoUrl());
    });

    it('outlives a working day, unlike a medical image URL', async () => {
      const expires = Number(new URL(await logoUrl()).searchParams.get('X-Amz-Expires'));

      expect(expires).toBeGreaterThanOrEqual(24 * 60 * 60);
    });

    it('tells the browser to keep it', async () => {
      const cacheControl = new URL(await logoUrl()).searchParams.get('response-cache-control');

      expect(cacheControl).toMatch(/^public, max-age=\d+/);
      // Inside the signature, so it cannot be stripped or forged on the way.
      expect(new URL(await logoUrl()).searchParams.get('X-Amz-SignedHeaders')).not.toBeNull();
    });

    // The chrome is drawn from the session's own response, so nothing waits on a second request.
    it('travels with the session bootstrap', async () => {
      const response = await context.app.inject({ method: 'GET', url: '/me', headers: asAdmin() });
      const profile = response.json() as { clinic: { name: unknown; logoUrl: string } };

      expect(profile.clinic.logoUrl).toBe(await logoUrl());
      expect(profile.clinic.name).toEqual({ ar: expect.any(String), en: expect.any(String) });
    });
  });
});
