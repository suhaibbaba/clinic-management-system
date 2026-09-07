import { Injectable } from '@nestjs/common';
import { LOOKUP_LIST } from '@clinic/shared';

import { documentDirection, documentStrings } from '@api/billing/pdf/document-strings';
import { LetterheadService } from '@api/billing/pdf/letterhead.service';
import { RtlPdf } from '@api/billing/pdf/pdf-builder';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { InventoryReportsService } from '@api/inventory/inventory-reports.service';
import { LookupsService } from '@api/lookups/lookups.service';

/** Technical values read left to right even inside an Arabic document. */
const LTR = { dir: 'ltr' } as const;

/**
 * The sheet somebody carries to a supplier.
 *
 * Printed rather than exported, because that is what it is for: a piece of
 * paper on a clipboard in a store room, ticked off by hand. Built with the
 * billing module's `RtlPdf` for the same reason the lab documents are — the
 * Arabic shaping and bidi ordering are hard enough once, and a headless
 * browser has no place on a cheap VPS (CLAUDE.md target infra).
 */
@Injectable()
export class InventoryDocumentsService {
  constructor(
    private readonly reports: InventoryReportsService,
    private readonly letterheads: LetterheadService,
    private readonly lookups: LookupsService,
  ) {}

  async shoppingList(actor: AuthenticatedUser): Promise<Buffer> {
    const clinic = await this.letterheads.load(actor.clinicId);
    const list = await this.reports.shoppingList(actor);
    // Units are an editable list: the sheet prints what this clinic calls them.
    const units = await this.lookups.labels(actor.clinicId, LOOKUP_LIST.ITEM_UNIT, clinic.language);
    const strings = documentStrings(clinic.language).shoppingList;

    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    await this.letterheads.draw(pdf, clinic);
    pdf.text(strings.title, { size: 16, weight: 'bold', align: 'centre', gap: 14 });
    pdf.field(strings.printedAt, formatDate(list.generatedAt), LTR);
    pdf.space(8);

    if (list.lines.length === 0) {
      pdf.text(strings.empty, { size: 11 });
    } else {
      pdf.table(
        [
          { width: 3, header: strings.columns.item },
          { width: 1.1, header: strings.columns.unit },
          { width: 1.1, header: strings.columns.current, align: 'end' },
          { width: 1.1, header: strings.columns.minimum, align: 'end' },
          { width: 1.4, header: strings.columns.suggested, align: 'end' },
          { width: 2, header: strings.columns.supplier },
        ],
        list.lines.map((line) => [
          line.nameAr,
          units.get(line.unit) ?? line.unit,
          line.quantity,
          line.minQuantity,
          line.suggested,
          line.supplierName ?? '—',
        ]),
      );

      pdf.space(8);
      pdf.text(strings.note, { size: 9, colour: [0.35, 0.35, 0.35] });
    }

    pdf.space(28);
    pdf.rule();
    pdf.text(`${strings.signature}: ____________________`, { size: 10 });

    return pdf.save();
  }
}

/** Gregorian, day first — the convention the rest of the printed documents use. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}
