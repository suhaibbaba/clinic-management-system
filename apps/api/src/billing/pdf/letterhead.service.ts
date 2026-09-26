import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { clinicScheduleSettings, documentSettings, personName } from "@clinic/shared";
import { eq } from "drizzle-orm";
import type { DocumentLanguage } from "@api/billing/pdf/document-strings";
import type { RtlPdf } from "@api/billing/pdf/pdf-builder";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics } from "@api/database/schema";
import { StorageService, type FetchedObject } from "@api/storage/storage.service";

export interface Letterhead {
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly currency: string;
  /** The clinic's own document language — never the reader's. */
  readonly language: DocumentLanguage;
  /** Dates print in the clinic's zone, not the server's. */
  readonly timeZone: string;
  readonly logo: FetchedObject | null;
}

// One service, so a clinic's logo cannot appear on three sheets and not the fourth. Fetched per
// document — a cache would hand out yesterday's mark on the day a clinic rebrands.
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

    return {
      name: personName({ ar: row.nameAr, en: row.nameEn }, language),
      address: row.address ?? "",
      phone: row.phone ?? "",
      currency: row.currency,
      language,
      timeZone: clinicScheduleSettings(row.settings).timezone,
      logo: row.logoKey ? await this.storage.getObject(row.logoKey) : null,
    };
  }

  async draw(pdf: RtlPdf, clinic: Letterhead, title: string, subtitle?: string): Promise<void> {
    pdf.title([title, subtitle, clinic.name].filter(Boolean).join(" — "));
    await pdf.letterhead({
      name: clinic.name,
      address: clinic.address,
      phone: clinic.phone,
      logo: clinic.logo,
      title,
      subtitle,
    });
  }
}
