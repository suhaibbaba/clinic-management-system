import {
  MAX_USER_PHOTO_BYTES,
  USER_ROLE,
  type AuthenticatedUserProfile,
  type Doctor,
  type Paginated,
  type PresignUserPhotoResponse,
  type User,
  type UserRole,
} from '@clinic/shared';

import { seedClinicFixtures } from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';
import { StorageService, type StoredObject } from '@api/storage/storage.service';

describe('Staff photo (e2e)', () => {
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

    // The doctor row that makes the photographed user appear on `/doctors`.
    await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    // Signing is offline; only the read-back of a stored object and the
    // cleanup delete need a stand-in.
    storage = context.app.get(StorageService);
    storage.statObject = async (): Promise<StoredObject | null> => storedObject;
    storage.deleteObject = async (key: string): Promise<void> => {
      deleted.push(key);
    };
  });

  beforeEach(() => {
    storedObject = { sizeBytes: 40_000, mime: 'image/jpeg' };
    deleted = [];
  });

  afterAll(async () => {
    await context.close();
  });

  const asAdmin = () => auth(tokens[USER_ROLE.ADMIN]);
  const subject = (): string => clinic.userIds[USER_ROLE.DOCTOR];

  const presign = async (payload: Record<string, unknown> = {}, id = subject()) =>
    context.app.inject({
      method: 'POST',
      url: `/users/${id}/photo/presign`,
      headers: asAdmin(),
      payload: { filename: 'layla.jpg', mime: 'image/jpeg', sizeBytes: 40_000, ...payload },
    });

  const confirm = async (key: string, id = subject()) =>
    context.app.inject({
      method: 'POST',
      url: `/users/${id}/photo`,
      headers: asAdmin(),
      payload: { key },
    });

  const upload = async (id = subject()): Promise<string> => {
    const key = ((await presign({}, id)).json() as PresignUserPhotoResponse).key;
    await confirm(key, id);

    return key;
  };

  describe('the happy path', () => {
    it('signs an upload, records the key, and hands back a URL to draw it with', async () => {
      const signed = await presign();
      expect(signed.statusCode).toBe(200);

      const response = signed.json() as PresignUserPhotoResponse;
      expect(response.maxSizeBytes).toBe(MAX_USER_PHOTO_BYTES);
      // The key is the API's, built from the caller's clinic and the person photographed, with one
      // folder per member of staff so it can be checked against both.
      expect(response.key).toMatch(new RegExp(`^clinic/${clinic.id}/staff/${subject()}/`));
      expect(response.uploadUrl).toContain(response.key);

      const confirmed = await confirm(response.key);
      expect(confirmed.statusCode).toBe(200);
      expect((confirmed.json() as User).photoUrl).toContain(response.key);
    });

    it('is on the list the admin screen reads, and never as a bare key', async () => {
      const key = await upload();

      const list = await context.app.inject({ method: 'GET', url: '/users', headers: asAdmin() });
      const row = (list.json() as Paginated<User>).items.find((user) => user.id === subject());

      expect(row?.photoUrl).toContain(key);
      // The stored key never leaves the API — what travels is a signed GET.
      expect(JSON.stringify(row)).not.toContain('"photoKey"');
    });

    /* The face beside a name on the doctors list and in the calendar's columns. */
    it('reaches the doctors list, signed the same way', async () => {
      const key = await upload();

      const list = await context.app.inject({ method: 'GET', url: '/doctors', headers: asAdmin() });
      const row = (list.json() as Paginated<Doctor>).items.find(
        (doctor) => doctor.user.id === subject(),
      );

      expect(row?.user.photoUrl).toContain(key);
    });

    /* Somebody's own photo, on their own profile — every role reads this one. */
    it('reaches the profile the owner sees', async () => {
      const key = await upload();

      const profile = await context.app.inject({
        method: 'GET',
        url: '/me',
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });

      expect((profile.json() as AuthenticatedUserProfile).photoUrl).toContain(key);
    });

    it('drops the image it replaces — a photo is one current face, not a history', async () => {
      const first = await upload();

      const second = ((await presign()).json() as PresignUserPhotoResponse).key;
      deleted = [];
      await confirm(second);

      expect(deleted).toEqual([first]);
    });

    it('goes back to initials, and takes the object with it', async () => {
      const key = await upload();
      deleted = [];

      const response = await context.app.inject({
        method: 'DELETE',
        url: `/users/${subject()}/photo`,
        headers: asAdmin(),
      });

      expect(response.statusCode).toBe(200);
      expect((response.json() as User).photoUrl).toBeNull();
      expect(deleted).toEqual([key]);
    });
  });

  describe('what it refuses', () => {
    it('refuses a file that is not an image, before signing anything', async () => {
      expect((await presign({ filename: 'cv.pdf', mime: 'application/pdf' })).statusCode).toBe(400);
    });

    it('refuses one over the ceiling, before signing anything', async () => {
      expect((await presign({ sizeBytes: MAX_USER_PHOTO_BYTES + 1 })).statusCode).toBe(400);
    });

    // The claim in the request body is not the file: what is checked on confirm is what the bytes
    // turned out to be.
    it('refuses bytes that turned out not to be an image, and deletes them', async () => {
      const key = ((await presign()).json() as PresignUserPhotoResponse).key;
      storedObject = { sizeBytes: 40_000, mime: 'application/zip' };

      expect((await confirm(key)).statusCode).toBe(400);
      expect(deleted).toEqual([key]);
    });

    it('refuses a key that was never uploaded to', async () => {
      const key = ((await presign()).json() as PresignUserPhotoResponse).key;
      storedObject = null;

      expect((await confirm(key)).statusCode).toBe(400);
    });

    // What one folder per member of staff buys: both keys belong to this clinic, and the second is
    // still not this user's.
    it("refuses a key from another user's folder in the same clinic", async () => {
      const stranger = clinic.userIds[USER_ROLE.RECEPTIONIST];
      const key = ((await presign({}, stranger)).json() as PresignUserPhotoResponse).key;

      expect((await confirm(key)).statusCode).toBe(400);
    });

    it('refuses a key from inside a patient folder', async () => {
      const response = await confirm(`clinic/${clinic.id}/patients/x/xray_panoramic/scan.png`);

      expect(response.statusCode).toBe(400);
    });

    it('refuses a key belonging to another clinic', async () => {
      const other = await context.createClinic();

      const response = await confirm(`clinic/${other.id}/staff/${subject()}/whatever.png`);

      expect(response.statusCode).toBe(400);
    });

    it('does not reach another clinic (a cross-clinic id is 404)', async () => {
      const other = await context.createClinic();
      const otherAdmin = await context.login(other.phones[USER_ROLE.ADMIN]);

      const response = await context.app.inject({
        method: 'POST',
        url: `/users/${subject()}/photo/presign`,
        headers: auth(otherAdmin),
        payload: { filename: 'x.png', mime: 'image/png', sizeBytes: 1000 },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('permissions (ROLES.md: staff accounts are the admin’s)', () => {
    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      'refuses %s the upload — even of their own face',
      async (role) => {
        const response = await context.app.inject({
          method: 'POST',
          url: `/users/${clinic.userIds[role]}/photo/presign`,
          headers: auth(tokens[role]),
          payload: { filename: 'me.png', mime: 'image/png', sizeBytes: 1000 },
        });

        expect(response.statusCode).toBe(403);
      },
    );

    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      'refuses %s the removal',
      async (role) => {
        const response = await context.app.inject({
          method: 'DELETE',
          url: `/users/${subject()}/photo`,
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(403);
      },
    );
  });
});
