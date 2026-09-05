import { ATTACHMENT_TYPE, MAX_ATTACHMENT_BYTES, USER_ROLE, type UserRole } from '@clinic/shared';

import { createPatient, uniquePhone } from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';
import { StorageService, type StoredObject } from '@api/storage/storage.service';

describe('Attachments (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let storage: StorageService;
  const tokens = {} as Record<UserRole, string>;

  let patientId: string;
  /** What the stubbed HeadObject reports for the next confirm. */
  let storedObject: StoredObject | null;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.RECEPTIONIST,
      USER_ROLE.TECHNICIAN,
    ]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    patientId = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
      fullName: 'مريض الصور الشعاعية',
      phone: uniquePhone(),
    });

    // Presigning is offline, so only the read-back of a stored object needs a
    // stand-in: everything else runs against the real S3 client.
    storage = context.app.get(StorageService);
    storage.statObject = async (): Promise<StoredObject | null> => storedObject;
  });

  beforeEach(() => {
    storedObject = { sizeBytes: 1024, mime: 'image/png' };
  });

  afterAll(async () => {
    await context.close();
  });

  const asDoctor = () => auth(tokens[USER_ROLE.DOCTOR]);

  const presign = async (overrides: Record<string, unknown> = {}) =>
    context.app.inject({
      method: 'POST',
      url: `/patients/${patientId}/attachments/presign-upload`,
      headers: asDoctor(),
      payload: {
        filename: 'periapical.png',
        mime: 'image/png',
        sizeBytes: 1024,
        type: ATTACHMENT_TYPE.XRAY_PERIAPICAL,
        ...overrides,
      },
    });

  const confirm = async (key: string, overrides: Record<string, unknown> = {}) =>
    context.app.inject({
      method: 'POST',
      url: `/patients/${patientId}/attachments/confirm`,
      headers: asDoctor(),
      payload: {
        key,
        filename: 'periapical.png',
        type: ATTACHMENT_TYPE.XRAY_PERIAPICAL,
        ...overrides,
      },
    });

  const upload = async (overrides: Record<string, unknown> = {}) => {
    const presigned = await presign();
    const { key } = presigned.json() as { key: string };
    const confirmed = await confirm(key, overrides);

    expect(confirmed.statusCode).toBe(201);
    return confirmed.json() as { id: string; tooth: number | null };
  };

  describe('presign', () => {
    it('returns a short-lived upload URL and its expiry', async () => {
      const before = Date.now();
      const response = await presign();

      expect(response.statusCode).toBe(201);

      const body = response.json() as {
        key: string;
        uploadUrl: string;
        expiresAt: string;
        maxSizeBytes: number;
      };

      expect(body.maxSizeBytes).toBe(MAX_ATTACHMENT_BYTES);

      // The URL is signed, time-limited and scoped to this clinic and patient.
      expect(body.uploadUrl).toContain('X-Amz-Signature');
      expect(body.uploadUrl).toContain('X-Amz-Expires=300');
      expect(body.key).toMatch(
        new RegExp(`^clinic/${clinic.id}/patients/${patientId}/xray_periapical/`),
      );

      const expiresAt = Date.parse(body.expiresAt);
      expect(expiresAt).toBeGreaterThan(before);
      expect(expiresAt).toBeLessThanOrEqual(before + 300_000 + 5_000);
    });

    it('rejects a content type outside the allow-list', async () => {
      const response = await presign({ mime: 'application/zip' });

      expect(response.statusCode).toBe(400);
    });

    it('rejects a file larger than the ceiling', async () => {
      const response = await presign({ sizeBytes: MAX_ATTACHMENT_BYTES + 1 });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('confirm', () => {
    it('records the size and type storage reports, not the ones claimed', async () => {
      storedObject = { sizeBytes: 4096, mime: 'image/png' };

      const presigned = await presign();
      const { key } = presigned.json() as { key: string };
      const response = await confirm(key, { tooth: 46, note: 'قبل المعالجة' });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        patientId,
        sizeBytes: 4096,
        mime: 'image/png',
        tooth: 46,
      });
    });

    it('never returns the object key', async () => {
      const presigned = await presign();
      const { key } = presigned.json() as { key: string };
      const response = await confirm(key);

      const body = response.json() as Record<string, unknown>;
      expect(body).not.toHaveProperty('r2Key');
      expect(JSON.stringify(body)).not.toContain(key);
    });

    it('rejects a key belonging to another patient', async () => {
      const otherPatientId = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
        fullName: 'مريض آخر',
        phone: uniquePhone(),
      });

      const response = await confirm(
        `clinic/${clinic.id}/patients/${otherPatientId}/xray_periapical/forged.png`,
      );

      expect(response.statusCode).toBe(400);
    });

    it('rejects a key belonging to another clinic', async () => {
      const response = await confirm(
        `clinic/00000000-0000-4000-8000-000000000000/patients/${patientId}/xray_periapical/x.png`,
      );

      expect(response.statusCode).toBe(400);
    });

    it('rejects a confirm with nothing actually uploaded', async () => {
      const presigned = await presign();
      const { key } = presigned.json() as { key: string };
      storedObject = null;

      const response = await confirm(key);

      expect(response.statusCode).toBe(400);
    });

    it('rejects an object whose stored content type is not allowed', async () => {
      const presigned = await presign();
      const { key } = presigned.json() as { key: string };
      storedObject = { sizeBytes: 1024, mime: 'application/zip' };

      const response = await confirm(key);

      expect(response.statusCode).toBe(400);
    });

    it('rejects the same key twice', async () => {
      const presigned = await presign();
      const { key } = presigned.json() as { key: string };

      expect((await confirm(key)).statusCode).toBe(201);
      expect((await confirm(key)).statusCode).toBe(409);
    });
  });

  describe('reads', () => {
    it('mints a signed, expiring download URL for a single attachment', async () => {
      const { id } = await upload();
      const before = Date.now();

      const response = await context.app.inject({
        method: 'GET',
        url: `/attachments/${id}`,
        headers: asDoctor(),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json() as { downloadUrl: string; downloadUrlExpiresAt: string };

      expect(body.downloadUrl).toContain('X-Amz-Signature');
      expect(body.downloadUrl).toContain('X-Amz-Expires=300');

      const expiresAt = Date.parse(body.downloadUrlExpiresAt);
      expect(expiresAt).toBeGreaterThan(before);
      expect(expiresAt).toBeLessThanOrEqual(before + 300_000 + 5_000);
    });

    it('does not mint URLs for a list — metadata only', async () => {
      await upload();

      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${patientId}/attachments`,
        headers: asDoctor(),
      });

      expect(response.statusCode).toBe(200);

      const { items } = response.json() as { items: Record<string, unknown>[] };
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item).not.toHaveProperty('downloadUrl');
        expect(item).not.toHaveProperty('r2Key');
      }
    });

    it('shows an attachment on the tooth it was taken of', async () => {
      await upload({ tooth: 37 });

      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${patientId}/teeth/37`,
        headers: asDoctor(),
      });

      const { attachments } = response.json() as { attachments: { tooth: number }[] };
      expect(attachments.length).toBeGreaterThan(0);
      expect(attachments.every((item) => item.tooth === 37)).toBe(true);
    });
  });

  describe('permissions (ROLES.md: receptionist responses never include attachment data)', () => {
    it.each([
      ['list', 'GET', (id: string) => `/patients/${id}/attachments`],
      ['presign', 'POST', (id: string) => `/patients/${id}/attachments/presign-upload`],
      ['confirm', 'POST', (id: string) => `/patients/${id}/attachments/confirm`],
    ])('refuses a receptionist the %s endpoint', async (_name, method, url) => {
      const response = await context.app.inject({
        method: method as 'GET' | 'POST',
        url: url(patientId),
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: {},
      });

      expect(response.statusCode).toBe(403);
    });

    it('refuses a receptionist a single attachment', async () => {
      const { id } = await upload();

      const response = await context.app.inject({
        method: 'GET',
        url: `/attachments/${id}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(403);
    });

    it('soft-deletes for admin only, and leaves the object in the bucket', async () => {
      const { id } = await upload();

      const asDoctorDelete = await context.app.inject({
        method: 'DELETE',
        url: `/attachments/${id}`,
        headers: asDoctor(),
      });
      expect(asDoctorDelete.statusCode).toBe(403);

      const asAdminDelete = await context.app.inject({
        method: 'DELETE',
        url: `/attachments/${id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });
      expect(asAdminDelete.statusCode).toBe(204);

      const rows = await context.db.execute(
        `select deleted_at, r2_key from attachments where id = '${id}'`,
      );
      expect([...rows][0]?.['deleted_at']).not.toBeNull();
      expect([...rows][0]?.['r2_key']).toBeTruthy();
    });
  });
});
