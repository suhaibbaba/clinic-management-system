import {
  CONTACT_MESSAGE_STATUS,
  USER_ROLE,
  defaultSiteContent,
  type ContactMessage,
  type Paginated,
  type PublicSite,
  type SiteContent,
  type WebsiteEditor,
} from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { auditLog } from "@api/database/schema";
import { seedClinicFixtures, uniquePhone } from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const content = (overrides: Partial<SiteContent> = {}): SiteContent => ({
  ...defaultSiteContent(),
  hero: {
    ...defaultSiteContent().hero,
    title: { ar: "ابتسامة أفضل", en: "A better smile" },
  },
  services: {
    ...defaultSiteContent().services,
    items: [
      {
        id: "cleaning",
        title: { ar: "تنظيف", en: "Cleaning" },
        description: { ar: "", en: "" },
        image: null,
      },
    ],
  },
  ...overrides,
});

describe("Website (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let without: TestClinic;
  let neighbour: TestClinic;
  let doctorId: string;
  let admin: Record<string, string>;
  let reception: Record<string, string>;
  let doctor: Record<string, string>;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    without = await context.createClinic({ modules: [] });
    neighbour = await context.createClinic();

    const adminToken = await context.login(clinic.phones[USER_ROLE.ADMIN]);
    admin = auth(adminToken);
    reception = auth(await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]));
    doctor = auth(await context.login(clinic.phones[USER_ROLE.DOCTOR]));
    doctorId = (await seedClinicFixtures(context, clinic, adminToken)).doctorId;
  });

  beforeEach(() => context.resetThrottle());

  afterAll(async () => {
    await context.close();
  });

  const inject = (
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
    url: string,
    headers: Record<string, string> = {},
    payload?: object,
  ) => context.app.inject({ method, url, headers, ...(payload !== undefined && { payload }) });

  describe("the paid module", () => {
    it("refuses the editor, even to the admin, while the module is off", async () => {
      const headers = auth(await context.login(without.phones[USER_ROLE.ADMIN]));

      expect((await inject("GET", "/website", headers)).statusCode).toBe(403);
      expect((await inject("GET", "/website/messages", headers)).statusCode).toBe(403);
    });

    it("answers 404 for the public site of a clinic without it", async () => {
      expect((await inject("GET", `/public/site/${without.slug}`)).statusCode).toBe(404);
    });
  });

  describe("permission boundaries", () => {
    it("keeps the editor to the admin", async () => {
      expect((await inject("GET", "/website", admin)).statusCode).toBe(200);
      expect((await inject("GET", "/website", reception)).statusCode).toBe(403);
      expect((await inject("GET", "/website", doctor)).statusCode).toBe(403);
      expect((await inject("PUT", "/website/draft", reception, content())).statusCode).toBe(403);
      expect((await inject("POST", "/website/publish", doctor)).statusCode).toBe(403);
    });

    it("opens the inbox to the admin and the receptionist only", async () => {
      expect((await inject("GET", "/website/messages", admin)).statusCode).toBe(200);
      expect((await inject("GET", "/website/messages", reception)).statusCode).toBe(200);
      expect((await inject("GET", "/website/messages", doctor)).statusCode).toBe(403);
    });
  });

  describe("draft and publish", () => {
    it("serves nothing publicly before the first publish", async () => {
      expect((await inject("GET", `/public/site/${clinic.slug}`)).statusCode).toBe(404);
    });

    it("rejects a service without a name", async () => {
      const draft = content();
      const broken = {
        ...draft,
        services: {
          ...draft.services,
          items: [{ ...draft.services.items[0]!, title: { ar: "", en: "" } }],
        },
      };

      expect((await inject("PUT", "/website/draft", admin, broken)).statusCode).toBe(400);
    });

    it("rejects an image key that is not the clinic's", async () => {
      const draft = content({
        story: {
          ...defaultSiteContent().story,
          title: { ar: "قصة", en: "" },
          image: "clinic/00000000-0000-4000-8000-000000000000/website/x.png",
        },
      });

      expect((await inject("PUT", "/website/draft", admin, draft)).statusCode).toBe(400);
    });

    it("keeps a saved draft private until it is published", async () => {
      const saved = await inject("PUT", "/website/draft", admin, content());

      expect(saved.statusCode).toBe(200);
      expect(saved.json<WebsiteEditor>().publishedAt).toBeNull();
      expect((await inject("GET", `/public/site/${clinic.slug}`)).statusCode).toBe(404);
    });

    it("publishes the draft and audits the change", async () => {
      const published = await inject("POST", "/website/publish", admin);

      expect(published.statusCode).toBe(200);
      expect(published.json<WebsiteEditor>().publishedAt).not.toBeNull();
      expect(published.json<WebsiteEditor>().unpublished).toBe(false);

      const site = await inject("GET", `/public/site/${clinic.slug}`);

      expect(site.statusCode).toBe(200);
      expect(site.json<PublicSite>().content.hero.title.ar).toBe("ابتسامة أفضل");
      expect(site.json<PublicSite>().doctors.map((entry) => entry.id)).toEqual([doctorId]);

      const entries = await context.db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.clinicId, clinic.id), eq(auditLog.entity, "site_content")));

      expect(entries.length).toBeGreaterThanOrEqual(2);
      expect(entries.some((entry) => entry.newValue !== null)).toBe(true);
    });

    it("leaves a hidden doctor out of the public answer, not only the page", async () => {
      const draft = content({
        doctors: { ...defaultSiteContent().doctors, hidden: [doctorId] },
      });

      await inject("PUT", "/website/draft", admin, draft);
      await inject("POST", "/website/publish", admin);

      const site = await inject("GET", `/public/site/${clinic.slug}`);

      expect(site.json<PublicSite>().doctors).toEqual([]);
    });

    it("never exposes the draft publicly", async () => {
      const draft = content({
        hero: { ...defaultSiteContent().hero, title: { ar: "مسودة سرية", en: "" } },
      });

      await inject("PUT", "/website/draft", admin, draft);

      const site = await inject("GET", `/public/site/${clinic.slug}`);
      const editor = await inject("GET", "/website", admin);

      expect(site.json<PublicSite>().content.hero.title.ar).toBe("ابتسامة أفضل");
      expect(editor.json<WebsiteEditor>().unpublished).toBe(true);
    });

    it("fills the head with the published title for crawlers", async () => {
      const head = await inject("GET", `/public/site/head?slug=${clinic.slug}`);

      expect(head.statusCode).toBe(200);
      expect(head.headers["content-type"]).toContain("text/html");
      expect(head.body).toContain("ابتسامة أفضل");
      expect(head.body).not.toContain("مسودة سرية");
    });
  });

  describe("contact messages", () => {
    const phone = uniquePhone();
    const message = (text = "أريد موعداً قريباً") => ({ name: "سارة أحمد", phone, message: text });

    it("takes a message from the public form", async () => {
      const sent = await inject("POST", `/public/site/${clinic.slug}/messages`, {}, message());

      expect(sent.statusCode).toBe(201);
      expect(sent.json()).toEqual({ received: true });
    });

    it("refuses an enquiry type the clinic does not offer", async () => {
      const refused = await inject(
        "POST",
        `/public/site/${clinic.slug}/messages`,
        {},
        { ...message("نوع غير معروف"), phone: uniquePhone(), topic: "unknown" },
      );

      expect(refused.statusCode).toBe(400);
    });

    it("caps messages from one phone", async () => {
      await inject("POST", `/public/site/${clinic.slug}/messages`, {}, message("رسالة ثانية"));
      await inject("POST", `/public/site/${clinic.slug}/messages`, {}, message("رسالة ثالثة"));
      context.resetThrottle();

      const capped = await inject(
        "POST",
        `/public/site/${clinic.slug}/messages`,
        {},
        message("رابعة"),
      );

      expect(capped.statusCode).toBe(429);
    });

    it("lists messages newest first, scoped to the clinic", async () => {
      const list = await inject("GET", "/website/messages", reception);
      const items = list.json<Paginated<ContactMessage>>().items;

      expect(items.map((item) => item.message)).toEqual([
        "رسالة ثالثة",
        "رسالة ثانية",
        "أريد موعداً قريباً",
      ]);

      const other = auth(await context.login(neighbour.phones[USER_ROLE.ADMIN]));
      const foreign = await inject("PATCH", `/website/messages/${items[0]!.id}`, other, {
        status: CONTACT_MESSAGE_STATUS.HANDLED,
      });

      expect(foreign.statusCode).toBe(404);
      expect(
        (await inject("GET", "/website/messages", other)).json<Paginated<ContactMessage>>().total,
      ).toBe(0);
    });

    it("marks a message handled, filters by status and deletes softly", async () => {
      const [first] = (await inject("GET", "/website/messages?limit=1", reception)).json<
        Paginated<ContactMessage>
      >().items;

      const handled = await inject("PATCH", `/website/messages/${first!.id}`, reception, {
        status: CONTACT_MESSAGE_STATUS.HANDLED,
      });

      expect(handled.statusCode).toBe(200);
      expect(handled.json<ContactMessage>().status).toBe(CONTACT_MESSAGE_STATUS.HANDLED);
      expect(handled.json<ContactMessage>().handledBy).not.toBeNull();

      const open = await inject("GET", "/website/messages?status=open", reception);

      expect(open.json<Paginated<ContactMessage>>().total).toBe(2);

      expect((await inject("DELETE", `/website/messages/${first!.id}`, reception)).statusCode).toBe(
        204,
      );
      expect(
        (await inject("GET", "/website/messages", reception)).json<Paginated<ContactMessage>>()
          .total,
      ).toBe(2);
    });

    it("refuses messages once the clinic switches the form off", async () => {
      await inject(
        "PUT",
        "/website/draft",
        admin,
        content({ contact: { ...defaultSiteContent().contact, formEnabled: false } }),
      );
      await inject("POST", "/website/publish", admin);

      const refused = await inject(
        "POST",
        `/public/site/${clinic.slug}/messages`,
        {},
        { ...message("بعد الإغلاق"), phone: uniquePhone() },
      );

      expect(refused.statusCode).toBe(403);
    });
  });
});
