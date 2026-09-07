import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { documentSettings } from '@clinic/shared';
import { eq } from 'drizzle-orm';

import { BRAND_MARK, MARK_VIEWBOX } from '@api/billing/pdf/brand-mark';
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
  /** The uploaded logo's bytes, or null for the built-in mark. */
  readonly logo: FetchedObject | null;
}

/**
 * The top of every printed sheet: the clinic's mark, its name, and how to
 * reach it.
 *
 * One service rather than a copy in each document service, because a clinic
 * that uploads a logo expects it on the receipt, the prescription, the lab
 * order sheet and the shopping list, and three near-identical letterheads is
 * exactly how one of them ends up still drawing the old placeholder.
 *
 * The logo is fetched per document rather than cached: it is two megabytes at
 * most, printing is rare next to everything else the API does, and a cache
 * would hand out yesterday's mark on the day a clinic rebrands.
 */
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

    return {
      name: row.name,
      contact: [row.phone, row.address].filter(Boolean).join(' — '),
      currency: row.currency,
      language: documentSettings(row.settings).language,
      logo: row.logoKey ? await this.storage.getObject(row.logoKey) : null,
    };
  }

  /**
   * The mark, then the clinic's own name: the sheet is the clinic's, and the
   * brand sits above it rather than in place of it. Both are centred so a long
   * Arabic name and a short one produce the same letterhead.
   *
   * The clinic's own logo when it has one, and the product's mark when it does
   * not — or when the upload is something pdf-lib cannot embed, which is why
   * the fallback is decided by whether the image actually drew.
   */
  async draw(pdf: RtlPdf, clinic: Letterhead): Promise<void> {
    const drawn = clinic.logo
      ? await pdf.image(clinic.logo.bytes, clinic.logo.mime)
      : /* istanbul ignore next -- short-circuited above. */ false;

    if (!drawn) {
      pdf.mark(BRAND_MARK, MARK_VIEWBOX);
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
