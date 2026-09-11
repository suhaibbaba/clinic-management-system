import { USER_ROLE, type ClinicNote, type Paginated, type UserRole } from '@clinic/shared';

import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

// The noticeboard is shared, so the interesting boundary is not "who may read it" — everyone may —
// but "whose note is whose" (ROLES.md core matrix), plus the clinic scope every table carries.
describe('Clinic notes (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let otherClinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;
  let otherClinicToken: string;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    otherClinic = await context.createClinic();

    for (const role of Object.values(USER_ROLE)) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    otherClinicToken = await context.login(otherClinic.phones[USER_ROLE.ADMIN]);
  });

  afterAll(async () => {
    await context.close();
  });

  const write = async (body: string, token: string): Promise<ClinicNote> => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/notes',
      headers: auth(token),
      payload: { body },
    });

    expect(response.statusCode).toBe(201);

    return response.json<ClinicNote>();
  };

  const read = async (token: string): Promise<Paginated<ClinicNote>> => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/notes',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(200);

    return response.json<Paginated<ClinicNote>>();
  };

  it('lets every role write to the board and read the whole of it', async () => {
    const written = await write('اتصل بالمختبر قبل الثانية', tokens[USER_ROLE.RECEPTIONIST]);

    expect(written.authorRole).toBe(USER_ROLE.RECEPTIONIST);
    expect(written.authorName?.ar).toBeTruthy();

    const asTechnician = await read(tokens[USER_ROLE.TECHNICIAN]);

    expect(asTechnician.items.map((note) => note.id)).toContain(written.id);
  });

  it("refuses to edit or delete somebody else's note, and lets the admin", async () => {
    const note = await write('ملاحظة الاستقبال', tokens[USER_ROLE.RECEPTIONIST]);

    const edit = await context.app.inject({
      method: 'PATCH',
      url: `/notes/${note.id}`,
      headers: auth(tokens[USER_ROLE.DOCTOR]),
      payload: { body: 'تعديل من طبيب' },
    });

    expect(edit.statusCode).toBe(403);

    const own = await context.app.inject({
      method: 'PATCH',
      url: `/notes/${note.id}`,
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      payload: { body: 'تعديل من صاحبها' },
    });

    expect(own.statusCode).toBe(200);
    expect(own.json<ClinicNote>().body).toBe('تعديل من صاحبها');

    const byAdmin = await context.app.inject({
      method: 'DELETE',
      url: `/notes/${note.id}`,
      headers: auth(tokens[USER_ROLE.ADMIN]),
    });

    expect(byAdmin.statusCode).toBe(204);

    const after = await read(tokens[USER_ROLE.ADMIN]);

    expect(after.items.map((row) => row.id)).not.toContain(note.id);
  });

  it("never shows one clinic another's board", async () => {
    const mine = await write('خاص بعيادتنا', tokens[USER_ROLE.ADMIN]);
    const theirs = await read(otherClinicToken);

    expect(theirs.items.map((note) => note.id)).not.toContain(mine.id);

    // Another clinic's id is 404, not 403: a 403 confirms the row exists somewhere.
    const reach = await context.app.inject({
      method: 'PATCH',
      url: `/notes/${mine.id}`,
      headers: auth(otherClinicToken),
      payload: { body: 'محاولة' },
    });

    expect(reach.statusCode).toBe(404);
  });
});
