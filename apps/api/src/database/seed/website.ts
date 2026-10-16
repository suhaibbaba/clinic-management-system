import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CLINIC_ICONS, CLINIC_MODULE, siteContentSchema } from "@clinic/shared";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@api/database/database.module";
import { clinics, doctors, siteContent, users } from "@api/database/schema";
import { LOGO_CATEGORY } from "@api/modules/clinics/constants";
import { iconKey } from "@api/modules/clinics/lib/clinics";
import type { StorageService } from "@api/modules/storage/services/storage.service";
import { photoCategory } from "@api/modules/users/lib/users";
import { SITE_IMAGE_CATEGORY } from "@api/modules/website/constants";
import {
  SITE_DOCTOR_PROFILES,
  SITE_PHOTOS,
  siteContent as buildSiteContent,
  type SitePhoto,
} from "@api/database/seed/site-content";

const ASSETS = join(__dirname, "assets");

const DOCTOR_PHOTOS = ["doctor-rasha.jpg", "doctor-basel.jpg"] as const;

type Storage = Pick<StorageService, "buildClinicObjectKey" | "putObject">;

export interface SeedWebsiteInput {
  readonly clinicId: string;
  readonly adminId: string;
  readonly doctorUserIds: readonly string[];
  readonly replaceContent?: boolean;
  readonly withDoctorPhotos?: boolean;
}

export async function seedWebsite(
  db: Database,
  storage: Storage,
  input: SeedWebsiteInput,
): Promise<string[]> {
  const notes: string[] = [];

  if (await seedBranding(db, storage, input.clinicId)) {
    notes.push("Uploaded the clinic logo and its icons.");
  }

  const photos = input.withDoctorPhotos === false ? 0 : await seedDoctorPhotos(db, storage, input);

  if (photos > 0) {
    notes.push(`Uploaded ${photos} doctor photo(s).`);
  }

  if (await seedSiteContent(db, storage, input)) {
    notes.push(
      input.replaceContent === true
        ? "Replaced the clinic website with the sample text and pictures, and published it."
        : "Published the clinic website with its text and pictures.",
    );
  }

  if (!(await hasWebsiteModule(db, input.clinicId))) {
    notes.push(
      `The website module is off for this clinic, so its site stays hidden — run ` +
        `\`pnpm -C apps/api module:enable ${input.clinicId} ${CLINIC_MODULE.WEBSITE}\`.`,
    );
  }

  return notes;
}

async function hasWebsiteModule(db: Database, clinicId: string): Promise<boolean> {
  const [clinic] = await db
    .select({ modules: clinics.modules })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  return clinic?.modules.includes(CLINIC_MODULE.WEBSITE) ?? false;
}

async function seedBranding(db: Database, storage: Storage, clinicId: string): Promise<boolean> {
  const [clinic] = await db
    .select({ logoKey: clinics.logoKey, appIconKey: clinics.appIconKey })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  if (!clinic || clinic.logoKey !== null || clinic.appIconKey !== null) {
    return false;
  }

  const logoKey = await upload(storage, clinicId, LOGO_CATEGORY, "logo.png", "image/png");
  const appIconKey = await upload(storage, clinicId, LOGO_CATEGORY, "app-icon.png", "image/png");

  for (const icon of CLINIC_ICONS) {
    await storage.putObject(
      iconKey(appIconKey, icon.name),
      await readFile(join(ASSETS, "icons", icon.name)),
      icon.mime,
    );
  }

  await db
    .update(clinics)
    .set({ logoKey, appIconKey, logoIconsAt: new Date(), updatedAt: new Date() })
    .where(eq(clinics.id, clinicId));

  return true;
}

async function seedDoctorPhotos(
  db: Database,
  storage: Storage,
  input: SeedWebsiteInput,
): Promise<number> {
  let uploaded = 0;

  for (const [index, userId] of input.doctorUserIds.entries()) {
    const file = DOCTOR_PHOTOS[index];
    const [user] = await db
      .select({ photoKey: users.photoKey })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!file || !user || user.photoKey !== null) {
      continue;
    }

    const photoKey = await upload(
      storage,
      input.clinicId,
      photoCategory(userId),
      `staff/${file}`,
      "image/jpeg",
    );

    await db.update(users).set({ photoKey, updatedAt: new Date() }).where(eq(users.id, userId));
    uploaded += 1;
  }

  return uploaded;
}

async function seedSiteContent(
  db: Database,
  storage: Storage,
  input: SeedWebsiteInput,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: siteContent.id })
    .from(siteContent)
    .where(eq(siteContent.clinicId, input.clinicId))
    .limit(1);

  if (existing && input.replaceContent !== true) {
    return false;
  }

  const keys = new Map<SitePhoto, string>();

  for (const name of SITE_PHOTOS) {
    keys.set(
      name,
      await upload(
        storage,
        input.clinicId,
        SITE_IMAGE_CATEGORY,
        `website/${name}.jpg`,
        "image/jpeg",
      ),
    );
  }

  const doctorRows = await db
    .select({ id: doctors.id, userId: doctors.userId })
    .from(doctors)
    .where(
      and(
        eq(doctors.clinicId, input.clinicId),
        inArray(doctors.userId, [...input.doctorUserIds]),
        isNull(doctors.deletedAt),
      ),
    );

  const profiles = input.doctorUserIds.flatMap((userId, index) => {
    const doctorId = doctorRows.find((row) => row.userId === userId)?.id;
    const profile = SITE_DOCTOR_PROFILES[index];

    return doctorId && profile ? [{ doctorId, ...profile }] : [];
  });

  const content = siteContentSchema.parse(
    buildSiteContent((name) => {
      const key = keys.get(name);

      if (!key) {
        throw new Error(`The seed has no website photo named ${name}`);
      }

      return key;
    }, profiles),
  );

  const now = new Date();

  if (existing) {
    await db
      .update(siteContent)
      .set({
        draft: content,
        published: content,
        publishedAt: now,
        publishedBy: input.adminId,
        updatedBy: input.adminId,
        updatedAt: now,
      })
      .where(eq(siteContent.id, existing.id));
  } else {
    await db.insert(siteContent).values({
      clinicId: input.clinicId,
      draft: content,
      published: content,
      publishedAt: now,
      publishedBy: input.adminId,
      createdBy: input.adminId,
      updatedBy: input.adminId,
    });
  }

  return true;
}

async function upload(
  storage: Storage,
  clinicId: string,
  category: string,
  file: string,
  mime: string,
): Promise<string> {
  const key = storage.buildClinicObjectKey({
    clinicId,
    category,
    filename: file.split("/").pop() ?? file,
  });

  await storage.putObject(key, await readFile(join(ASSETS, file)), mime);

  return key;
}
