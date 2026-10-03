import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { clinicScheduleSettings, documentSettings, personName } from "@clinic/shared";
import { eq } from "drizzle-orm";
import { documentStrings, type DocumentLanguage } from "@api/modules/billing/pdf/document-strings";
import { documentDate, documentDateTime } from "@api/modules/billing/pdf/document-format";
import { isolateLtr } from "@api/modules/billing/pdf/arabic-text";
import type { RtlPdf } from "@api/modules/billing/pdf/pdf-builder";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics } from "@api/database/schema";
import { StorageService } from "@api/modules/storage/services/storage.service";
import { type FetchedObject } from "@api/common/types/storage";

export interface Letterhead {
  readonly name: string;
  readonly otherName: string;
  readonly address: string;
  readonly phone: string;
  readonly email: string;
  readonly currency: string;
  readonly language: DocumentLanguage;
  readonly timeZone: string;
  readonly logo: FetchedObject | null;
}

@Injectable()
export class LetterheadService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async load(clinicId: string): Promise<Letterhead> {
    const [row] = await this.db
      .select({
        nameAr: clinics.nameAr,
        nameEn: clinics.nameEn,
        phone: clinics.phone,
        email: clinics.email,
        address: clinics.address,
        currency: clinics.currency,
        settings: clinics.settings,
        logoKey: clinics.logoKey,
      })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    const language = documentSettings(row.settings).language;
    const names = { ar: row.nameAr, en: row.nameEn };
    const name = personName(names, language);
    const otherName = personName(names, language === "ar" ? "en" : "ar");

    return {
      name,
      otherName: otherName === name ? "" : otherName,
      address: row.address ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      currency: row.currency,
      language,
      timeZone: clinicScheduleSettings(row.settings).timezone,
      logo: row.logoKey ? await this.storage.getObject(row.logoKey) : null,
    };
  }

  async draw(pdf: RtlPdf, clinic: Letterhead, title: string, subtitle?: string): Promise<void> {
    const now = new Date().toISOString();

    pdf.title([title, subtitle, clinic.name].filter(Boolean).join(" — "));
    await pdf.letterhead({
      name: clinic.name,
      otherName: clinic.otherName,
      address: clinic.address,
      phone: clinic.phone,
      email: clinic.email,
      logo: clinic.logo,
      title,
      subtitle,
      issued: documentDate(now, clinic.timeZone),
      printed: `${documentStrings(clinic.language).common.printed} ${isolateLtr(documentDateTime(now, clinic.timeZone))}`,
    });
  }
}
