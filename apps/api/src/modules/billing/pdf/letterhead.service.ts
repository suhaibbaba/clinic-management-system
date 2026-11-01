import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  clinicLocale,
  documentLanguage,
  localized,
  numberSeparators,
  type ClockFormat,
  type NumberSeparators,
} from "@clinic/shared";
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
  readonly languages: readonly DocumentLanguage[];
  readonly timeZone: string;
  readonly clock: ClockFormat;
  readonly separators: NumberSeparators;
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
        name: clinics.name,
        country: clinics.country,
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

    const locale = clinicLocale(row);
    const language = documentLanguage(row);
    const name = localized(row.name, language, locale.languages);
    const other = locale.languages.find((code) => code !== language);
    const otherName = other ? localized(row.name, other) : "";

    return {
      name,
      otherName: otherName === name ? "" : otherName,
      address: localized(row.address, language, locale.languages),
      phone: row.phone ?? "",
      email: row.email ?? "",
      currency: row.currency,
      language,
      languages: locale.languages,
      timeZone: locale.timeZone,
      clock: locale.clock,
      separators: numberSeparators(locale.numberLocale),
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
      printed: `${documentStrings(clinic.language).common.printed} ${isolateLtr(documentDateTime(now, clinic.timeZone, clinic.clock))}`,
    });
  }
}
