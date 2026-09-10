import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { documentSettings, personName } from '@clinic/shared';
import { eq } from 'drizzle-orm';

import type { DocumentLanguage } from '@api/billing/pdf/document-strings';
import type { RtlPdf } from '@api/billing/pdf/pdf-builder';
import { DATABASE, type Database } from '@api/database/database.module';
import { clinics } from '@api/database/schema';
import { StorageService, type FetchedObject } from '@api/storage/storage.service';

export interface Letterhead {
  readonly name: string;
  readonly contact: string;
  readonly currency: string;
  /** The clinic's own document language — never the reader's. */
  readonly language: DocumentLanguage;
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

    /* istanbul ignore next -- the caller's own clinic always exists. */
    if (!row) {
      throw new NotFoundException('Resource not found');
    }

    const language = documentSettings(row.settings).language;

    return {
      name: personName({ ar: row.nameAr, en: row.nameEn }, language),
      contact: [row.phone, row.address].filter(Boolean).join(' — '),
      currency: row.currency,
      language,
      logo: row.logoKey ? await this.storage.getObject(row.logoKey) : null,
    };
  }

  // A clinic with no logo gets its name and nothing else: a stand-in mark on a receipt would be
  // another clinic's branding on this one's paper.
  async draw(pdf: RtlPdf, clinic: Letterhead): Promise<void> {
    if (clinic.logo) {
      await pdf.image(clinic.logo.bytes, clinic.logo.mime);
    }

    pdf.text(clinic.name, { size: 18, weight: 'bold', align: 'centre', gap: 4 });

    if (clinic.contact) {
      pdf.text(clinic.contact, {
        size: 9,
        align: 'centre',
        colour: [0.35, 0.35, 0.35],
        // A phone number keeps its leading `+` on the left, as it is dialled.
        dir: 'ltr',
      });
    }

    pdf.rule();
  }
}
