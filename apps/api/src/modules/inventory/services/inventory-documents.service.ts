import { Injectable } from "@nestjs/common";
import { LOOKUP_LIST, renderTemplate, type PurchaseRequest } from "@clinic/shared";
import { documentDirection, documentStrings } from "@api/modules/billing/pdf/document-strings";
import { LetterheadService } from "@api/modules/billing/pdf/letterhead.service";
import { documentDate, fillPage } from "@api/modules/billing/pdf/document-format";
import { MUTED, RtlPdf } from "@api/modules/billing/pdf/pdf-builder";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { InventoryReportsService } from "@api/modules/inventory/services/inventory-reports.service";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";

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
          line.supplierName ?? "--",
        ]),
      );

      pdf.text(strings.note, { size: 9, colour: MUTED, gap: 12 });
    }

    pdf.space(12);
    pdf.signatures([strings.signature]);

    return pdf.save();
  }

  async purchaseRequest(
    actor: AuthenticatedUser,
    request: PurchaseRequest,
    withPrices: boolean,
  ): Promise<Buffer> {
    const clinic = await this.letterheads.load(actor.clinicId);
    const units = await this.lookups.labels(actor.clinicId, LOOKUP_LIST.ITEM_UNIT, clinic.language);
    const strings = documentStrings(clinic.language).purchaseRequest;
    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    await this.letterheads.draw(
      pdf,
      clinic,
      `${strings.title} ${request.number}`,
      documentDate(new Date().toISOString(), clinic.timeZone),
    );
    pdf.footer((page, total) =>
      fillPage(documentStrings(clinic.language).common.page, page, total),
    );

    pdf.text(renderTemplate(strings.greeting, { supplier: request.supplierName ?? "" }), {
      size: 11,
    });

    if (request.neededBy) {
      pdf.text(
        `${strings.neededBy}: ${documentDate(`${request.neededBy}T12:00:00.000Z`, clinic.timeZone)}`,
        {
          size: 10,
          colour: MUTED,
        },
      );
    }

    pdf.space(8);
    pdf.table(
      [
        { width: 3, header: strings.columns.item },
        { width: 1.2, header: strings.columns.unit },
        { width: 1.2, header: strings.columns.quantity, align: "end", ltr: true },
        ...(withPrices
          ? [{ width: 1.3, header: strings.columns.lastPrice, align: "end" as const, ltr: true }]
          : []),
      ],
      request.lines
        .filter((line) => Number(line.open) > 0)
        .map((line) => [
          line.itemName,
          units.get(line.unit) ?? line.unit,
          { text: line.open, weight: "bold" as const },
          ...(withPrices ? [line.lastPrice ?? "--"] : []),
        ]),
    );

    if (request.note) {
      pdf.text(`${strings.note}: ${request.note}`, { size: 9, colour: MUTED, gap: 12 });
    }

    pdf.space(12);
    pdf.signatures([strings.signature]);

    return pdf.save();
  }
}
