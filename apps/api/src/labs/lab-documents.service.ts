import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  currencySymbol,
  formatMinorUnits,
  LAB_STATEMENT_ENTRY_KIND,
  personName,
  toMinorUnits,
  type LabStatement,
  type Money,
  type StatementQuery,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { isolateLtr } from "@api/billing/pdf/arabic-text";
import {
  documentDate,
  documentDateTime,
  documentMoney,
  fillPage,
} from "@api/billing/pdf/document-format";
import { documentDirection, documentStrings } from "@api/billing/pdf/document-strings";
import { LetterheadService } from "@api/billing/pdf/letterhead.service";
import { RtlPdf } from "@api/billing/pdf/pdf-builder";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { doctors, labWorkTypes, labs, patients, users } from "@api/database/schema";
import { labOrders } from "@api/database/schema";
import { LabLedgerService } from "@api/labs/lab-ledger.service";

@Injectable()
export class LabDocumentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly letterheads: LetterheadService,
    private readonly ledger: LabLedgerService,
  ) {}

  async orderSheet(actor: AuthenticatedUser, orderId: string): Promise<Buffer> {
    const [row] = await this.db
      .select({
        order: labOrders,
        patientName: patients.fullName,
        doctorNameAr: users.nameAr,
        doctorNameEn: users.nameEn,
        labName: labs.name,
        workTypeName: labWorkTypes.name,
      })
      .from(labOrders)
      .innerJoin(patients, eq(patients.id, labOrders.patientId))
      .innerJoin(labs, eq(labs.id, labOrders.labId))
      .innerJoin(doctors, eq(doctors.id, labOrders.doctorId))
      .innerJoin(users, eq(users.id, doctors.userId))
      .leftJoin(labWorkTypes, eq(labWorkTypes.id, labOrders.workTypeId))
      .where(eq(labOrders.id, orderId))
      .limit(1);

    if (!row || row.order.clinicId !== actor.clinicId || row.order.deletedAt !== null) {
      throw new NotFoundException("Resource not found");
    }

    const clinic = await this.letterheads.load(actor.clinicId);
    const strings = documentStrings(clinic.language).labOrder;
    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    const zone = clinic.timeZone;
    await this.letterheads.draw(pdf, clinic, strings.title, isolateLtr(shortId(row.order.id)));
    pdf.footer((page, total) =>
      fillPage(documentStrings(clinic.language).common.page, page, total),
    );

    pdf.infoGrid([
      { label: strings.lab, value: row.labName },
      { label: strings.date, value: documentDate(new Date().toISOString(), zone), ltr: true },
      { label: strings.patient, value: firstName(row.patientName) },
      {
        label: strings.doctor,
        value: personName({ ar: row.doctorNameAr, en: row.doctorNameEn }, clinic.language),
      },
    ]);

    pdf.infoGrid(
      [
        { label: strings.workType, value: row.workTypeName ?? "—" },
        {
          label: strings.teeth,
          value: row.order.teeth.length > 0 ? row.order.teeth.join(" · ") : "—",
          ltr: true,
        },
        { label: strings.material, value: row.order.material ?? "—", ltr: true },
        { label: strings.shade, value: row.order.shade ?? "—", ltr: true },
        {
          label: strings.expected,
          value: row.order.expectedAt
            ? documentDate(row.order.expectedAt.toISOString(), zone)
            : "—",
          ltr: true,
        },
      ],
      3,
    );

    if (row.order.instructions) {
      pdf.text(strings.instructions, { size: 11, weight: "bold", gap: 2 });
      pdf.text(row.order.instructions, { size: 10.5, gap: 12 });
    }

    pdf.space(12);
    pdf.signatures([strings.signature]);

    return pdf.save();
  }

  async statement(actor: AuthenticatedUser, labId: string, query: StatementQuery): Promise<Buffer> {
    const clinic = await this.letterheads.load(actor.clinicId);
    const statement = await this.ledger.statementFor(actor.clinicId, labId, query);

    const strings = documentStrings(clinic.language).labStatement;
    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    const zone = clinic.timeZone;
    const money = (amount: Money): string => documentMoney(amount, clinic.currency);
    const figure = (amount: Money): string => documentMoney(amount, "");
    const symbol = currencySymbol(clinic.currency);
    const withSymbol = (header: string): string => (symbol ? `${header} (${symbol})` : header);

    await this.letterheads.draw(pdf, clinic, strings.title);
    pdf.footer((page, total) =>
      fillPage(documentStrings(clinic.language).common.page, page, total),
    );

    pdf.infoGrid([
      { label: strings.lab, value: statement.labName },
      {
        label: strings.printedAt,
        value: documentDateTime(new Date().toISOString(), zone),
        ltr: true,
      },
      {
        label: statement.from ? strings.period : strings.periodUntil,
        value: formatPeriod(statement, zone),
        ltr: true,
      },
    ]);

    let owed = 0;
    let paid = 0;

    if (statement.entries.length === 0) {
      pdf.text(strings.empty, { size: 11, colour: [0.38, 0.44, 0.49], align: "centre", gap: 12 });
    } else {
      pdf.table(
        [
          { width: 1.3, header: strings.columns.date, ltr: true },
          { width: 3.6, header: strings.columns.description },
          { width: 1.2, header: withSymbol(strings.columns.order), align: "end", ltr: true },
          { width: 1.2, header: withSymbol(strings.columns.payment), align: "end", ltr: true },
          { width: 1.3, header: withSymbol(strings.columns.balance), align: "end", ltr: true },
        ],
        statement.entries.map((entry) => {
          const isPayment = entry.kind === LAB_STATEMENT_ENTRY_KIND.PAYMENT;
          const minor = toMinorUnits(entry.amount);

          if (isPayment) {
            paid -= minor;
          } else {
            owed += minor;
          }

          return [
            documentDate(entry.occurredAt, zone),
            {
              text:
                entry.description || (isPayment ? strings.columns.payment : strings.columns.order),
              sub: entry.isReversal ? strings.reversal : undefined,
            },
            isPayment ? "" : figure(entry.amount),
            isPayment ? figure(formatMinorUnits(-minor)) : "",
            { text: figure(entry.runningBalance), weight: "medium" as const },
          ];
        }),
      );
    }

    pdf.totals([
      ...(Number(statement.openingBalance) !== 0 || statement.from
        ? [{ label: strings.openingBalance, value: money(statement.openingBalance) }]
        : []),
      { label: strings.columns.order, value: money(formatMinorUnits(owed)) },
      { label: strings.columns.payment, value: money(formatMinorUnits(paid)) },
      { label: strings.closingBalance, value: money(statement.closingBalance), strong: true },
    ]);

    return pdf.save();
  }
}

/** Enough of the id to match a box to a record, short enough to read aloud. */
const shortId = (id: string): string => id.slice(0, 8).toUpperCase();

const firstName = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? fullName;

function formatPeriod(statement: LabStatement, timeZone: string): string {
  const to = documentDate(statement.to ?? new Date().toISOString(), timeZone);

  return statement.from ? `${documentDate(statement.from, timeZone)} – ${to}` : to;
}
