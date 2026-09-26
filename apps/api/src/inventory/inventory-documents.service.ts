import { Injectable } from "@nestjs/common";
import { LOOKUP_LIST } from "@clinic/shared";
import { documentDirection, documentStrings } from "@api/billing/pdf/document-strings";
import { LetterheadService } from "@api/billing/pdf/letterhead.service";
import { documentDate, fillPage } from "@api/billing/pdf/document-format";
import { MUTED, RtlPdf } from "@api/billing/pdf/pdf-builder";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { InventoryReportsService } from "@api/inventory/inventory-reports.service";
import { LookupsService } from "@api/lookups/lookups.service";

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
    const units = await this.lookups.labels(actor.clinicId, LOOKUP_LIST.ITEM_UNIT, clinic.language);
    const strings = documentStrings(clinic.language).shoppingList;

    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    await this.letterheads.draw(
      pdf,
      clinic,
      strings.title,
      documentDate(list.generatedAt, clinic.timeZone),
    );
    pdf.footer((page, total) =>
      fillPage(documentStrings(clinic.language).common.page, page, total),
    );

    if (list.lines.length === 0) {
      pdf.text(strings.empty, { size: 11 });
    } else {
      pdf.table(
        [
          { width: 3, header: strings.columns.item },
          { width: 1.1, header: strings.columns.unit },
          { width: 1.1, header: strings.columns.current, align: "end", ltr: true },
          { width: 1.1, header: strings.columns.minimum, align: "end", ltr: true },
          { width: 1.4, header: strings.columns.suggested, align: "end", ltr: true },
          { width: 2, header: strings.columns.supplier },
        ],
        list.lines.map((line) => [
          line.name,
          units.get(line.unit) ?? line.unit,
          line.quantity,
          line.minQuantity,
          { text: line.suggested, weight: "bold" as const },
          line.supplierName ?? "—",
        ]),
      );

      pdf.text(strings.note, { size: 9, colour: MUTED, gap: 12 });
    }

    pdf.space(12);
    pdf.signatures([strings.signature]);

    return pdf.save();
  }
}
