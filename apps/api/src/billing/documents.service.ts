import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  currencySymbol,
  formatMinorUnits,
  LOOKUP_LIST,
  LEDGER_ENTRY_KIND,
  toMinorUnits,
  type Money,
  type Statement,
  type StatementEntry,
  type StatementQuery,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { LedgerService } from "@api/billing/ledger.service";
import { toPayment } from "@api/billing/payments.service";
import {
  documentDirection,
  documentStrings,
  type DocumentStrings,
} from "@api/billing/pdf/document-strings";
import { LetterheadService } from "@api/billing/pdf/letterhead.service";
import { LookupsService } from "@api/lookups/lookups.service";
import {
  documentDate,
  documentDateTime,
  documentMoney,
  fillPage,
  receiptNumber,
} from "@api/billing/pdf/document-format";
import { A4, RtlPdf, type Cell } from "@api/billing/pdf/pdf-builder";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { payments } from "@api/database/schema";
import { PatientAccessService } from "@api/patients/patient-access.service";

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly letterheads: LetterheadService,
    private readonly lookups: LookupsService,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly ledger: LedgerService,
  ) {}

  /** A receipt reprints identically every time: it is built from the ledger. */
  async receipt(actor: AuthenticatedUser, paymentId: string): Promise<Buffer> {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(this.scope.where(payments, actor.clinicId, eq(payments.id, paymentId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    const payment = toPayment(row);
    const patient = await this.patientAccess.requirePatient(actor, payment.patientId);
    const clinic = await this.letterheads.load(actor.clinicId);
    // The balance as this payment left it, not as it stands today: a reprint must not change.
    const ledger = await this.ledger.statementFor(actor.clinicId, payment.patientId, {});
    const balanceAfter =
      ledger.entries.find((entry) => entry.id === payment.id)?.runningBalance ??
      ledger.closingBalance;

    const reversesId = payment.reversesId;
    const isReversal = reversesId !== null;
    const reversedNumber = reversesId === null ? null : await this.receiptNumberOf(reversesId);

    const strings = documentStrings(clinic.language);
    const text = strings.receipt;
    const pdf = await RtlPdf.create({
      size: { width: A4.width, height: A4.height / 2 },
      direction: documentDirection(clinic.language),
      margin: 32,
    });

    const number =
      payment.receiptNumber !== null
        ? receiptNumber(payment.receiptNumber)
        : reversedNumber !== null
          ? `${text.reversalOf} ${receiptNumber(reversedNumber)}`
          : undefined;
    await this.letterheads.draw(pdf, clinic, isReversal ? text.reversalTitle : text.title, number);

    const methods = await this.lookups.labels(
      actor.clinicId,
      LOOKUP_LIST.PAYMENT_METHOD,
      clinic.language,
    );
    pdf.infoGrid(
      [
        { label: text.patient, value: patient.fullName },
        { label: text.fileNumber, value: patient.fileNumber, ltr: true },
        {
          label: text.date,
          value: documentDateTime(payment.createdAt, clinic.timeZone),
          ltr: true,
        },
        { label: text.method, value: methods.get(payment.method) ?? payment.method },
      ],
      4,
    );

    pdf.amount(
      isReversal ? text.reversedAmount : text.amount,
      documentMoney(payment.amount.replace("-", ""), clinic.currency),
      payment.note ? `${text.note}: ${payment.note}` : undefined,
    );

    pdf.totals([
      {
        label: isReversal ? text.balanceAfterReversal : text.balanceAfter,
        value: documentMoney(balanceAfter, clinic.currency),
      },
    ]);
    pdf.signatures([text.signature, text.stamp]);

    return pdf.save();
  }

  async statement(
    actor: AuthenticatedUser,
    patientId: string,
    query: StatementQuery,
  ): Promise<Buffer> {
    const patient = await this.patientAccess.requirePatient(actor, patientId);
    const clinic = await this.letterheads.load(actor.clinicId);
    const statement = await this.ledger.statementFor(actor.clinicId, patientId, query);

    const strings = documentStrings(clinic.language);
    const text = strings.statement;
    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });
    const zone = clinic.timeZone;
    const money = (amount: Money): string => documentMoney(amount, clinic.currency);
    const figure = (amount: Money): string => documentMoney(amount, "");

    await this.letterheads.draw(pdf, clinic, text.title);
    pdf.footer((page, total) => fillPage(strings.common.page, page, total));

    pdf.infoGrid([
      { label: text.patient, value: patient.fullName },
      { label: text.fileNumber, value: patient.fileNumber, ltr: true },
      // A range stays left to right, or bidi swaps its two ends; "all entries until" reads in the
      // sheet's own direction.
      {
        label: text.period,
        value: formatPeriod(statement, zone, text.all),
        ltr: statement.from !== null,
      },
      { label: text.printedAt, value: documentDateTime(new Date().toISOString(), zone), ltr: true },
    ]);

    let charged = 0;
    let paid = 0;

    if (statement.entries.length === 0) {
      pdf.text(text.empty, { size: 11, colour: [0.38, 0.44, 0.49], align: "centre", gap: 12 });
    } else {
      const symbol = currencySymbol(clinic.currency);
      const withSymbol = (header: string): string => (symbol ? `${header} (${symbol})` : header);

      pdf.table(
        [
          { width: 1.3, header: text.columns.date, ltr: true },
          { width: 3.6, header: text.columns.description },
          { width: 1.2, header: withSymbol(text.columns.charge), align: "end", ltr: true },
          { width: 1.2, header: withSymbol(text.columns.payment), align: "end", ltr: true },
          { width: 1.3, header: withSymbol(text.columns.balance), align: "end", ltr: true },
        ],
        statement.entries.map((entry) => {
          const minor = toMinorUnits(entry.amount);
          const isPayment = entry.kind === LEDGER_ENTRY_KIND.PAYMENT;

          if (isPayment) {
            paid -= minor;
          } else {
            charged += minor;
          }

          return [
            documentDate(entry.occurredAt, zone),
            describe(entry, text),
            isPayment ? "" : figure(entry.amount),
            isPayment ? figure(formatMinorUnits(-minor)) : "",
            { text: figure(entry.runningBalance), weight: "medium" as const },
          ];
        }),
      );
    }

    pdf.totals([
      ...(Number(statement.openingBalance) !== 0 || statement.from
        ? [{ label: text.openingBalance, value: money(statement.openingBalance) }]
        : []),
      { label: text.totalCharges, value: money(formatMinorUnits(charged)) },
      { label: text.totalPayments, value: money(formatMinorUnits(paid)) },
      { label: text.closingBalance, value: money(statement.closingBalance), strong: true },
    ]);

    return pdf.save();
  }

  private async receiptNumberOf(paymentId: string): Promise<number | null> {
    const [row] = await this.db
      .select({ receiptNumber: payments.receiptNumber })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    return row?.receiptNumber ?? null;
  }
}

// What a line is, and under it what was said about it: the note, or that it undoes another line.
function describe(entry: StatementEntry, text: DocumentStrings["statement"]): Cell {
  if (entry.kind === LEDGER_ENTRY_KIND.PAYMENT) {
    const title = entry.isReversal
      ? text.reversedPayment
      : entry.receiptNumber !== null
        ? `${text.payment} ${receiptNumber(entry.receiptNumber)}`
        : text.payment;

    return { text: title, sub: entry.note ?? undefined };
  }

  const note = entry.note && entry.note !== entry.description ? entry.note : undefined;
  const sub = [entry.isReversal ? text.reversal : undefined, note].filter(Boolean).join(" · ");

  return { text: entry.description || text.columns.charge, sub: sub || undefined };
}

function formatPeriod(statement: Statement, timeZone: string, all: string): string {
  const to = documentDate(statement.to ?? new Date().toISOString(), timeZone);

  return statement.from ? `${documentDate(statement.from, timeZone)} – ${to}` : `${all} ${to}`;
}
