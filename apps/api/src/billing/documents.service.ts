import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  LOOKUP_LIST,
  LEDGER_ENTRY_KIND,
  toMinorUnits,
  type Money,
  type Statement,
  type StatementQuery,
} from '@clinic/shared';
import { eq } from 'drizzle-orm';

import { LedgerService } from '@api/billing/ledger.service';
import { toPayment } from '@api/billing/payments.service';
import {
  documentDirection,
  documentStrings,
  type DocumentStrings,
} from '@api/billing/pdf/document-strings';
import { LetterheadService } from '@api/billing/pdf/letterhead.service';
import { LookupsService } from '@api/lookups/lookups.service';
import { A4, RtlPdf } from '@api/billing/pdf/pdf-builder';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { payments } from '@api/database/schema';
import { PatientAccessService } from '@api/patients/patient-access.service';

// Keeps a leading `+` on the left and stops the bidi algorithm swapping the ends of a date range in
// an Arabic document.
const LTR = { dir: 'ltr' } as const;

// pdf-lib with an embedded Amiri font, not a headless browser: Chromium beside Node would roughly
// triple the container's memory.
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
      throw new NotFoundException('Resource not found');
    }

    const payment = toPayment(row);
    const patient = await this.patientAccess.requirePatient(actor, payment.patientId);
    const clinic = await this.letterheads.load(actor.clinicId);
    const balance = await this.ledger.balanceFor(actor.clinicId, payment.patientId);

    const reversesId = payment.reversesId;
    const isReversal = reversesId !== null;
    const reversedNumber = reversesId === null ? null : await this.receiptNumberOf(reversesId);

    const strings = documentStrings(clinic.language).receipt;
    const pdf = await RtlPdf.create({
      size: { width: A4.width, height: A4.height / 2 },
      direction: documentDirection(clinic.language),
    });

    await this.letterheads.draw(pdf, clinic);
    pdf.text(isReversal ? strings.reversalTitle : strings.title, {
      size: 16,
      weight: 'bold',
      align: 'centre',
      gap: 14,
    });

    if (payment.receiptNumber !== null) {
      pdf.field(strings.number, formatSequence(payment.receiptNumber), LTR);
    }
    if (reversedNumber !== null) {
      pdf.field(strings.reversalOf, formatSequence(reversedNumber), LTR);
    }

    pdf.field(strings.date, formatDate(payment.createdAt), LTR);
    pdf.field(strings.patient, patient.fullName);
    pdf.field(strings.fileNumber, patient.fileNumber, LTR);
    pdf.field(strings.amount, formatAmount(payment.amount, clinic.currency), LTR);
    // What *this* clinic calls this method, in the document's language — the
    // payment methods are an editable list now, so there is no map to read.
    const methods = await this.lookups.labels(
      actor.clinicId,
      LOOKUP_LIST.PAYMENT_METHOD,
      clinic.language,
    );
    pdf.field(strings.method, methods.get(payment.method) ?? payment.method);

    if (payment.note) {
      pdf.field(strings.note, payment.note);
    }

    pdf.space(4);
    pdf.field(strings.balanceAfter, formatAmount(balance.balance, clinic.currency), LTR);

    pdf.space(24);
    pdf.text(`${strings.signature}: ____________________`, { size: 10 });

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

    const strings = documentStrings(clinic.language).statement;
    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    await this.letterheads.draw(pdf, clinic);
    pdf.text(strings.title, { size: 16, weight: 'bold', align: 'centre', gap: 14 });

    pdf.field(strings.patient, patient.fullName);
    pdf.field(strings.fileNumber, patient.fileNumber, LTR);
    // With no start date the statement covers the whole record, so the line
    // says "up to" rather than naming a beginning that does not exist.
    pdf.field(statement.from ? strings.period : strings.periodUntil, formatPeriod(statement), LTR);
    pdf.field(strings.printedAt, formatDate(new Date().toISOString()), LTR);
    pdf.space(8);
    pdf.field(strings.openingBalance, formatAmount(statement.openingBalance, clinic.currency), LTR);
    pdf.space(6);

    if (statement.entries.length === 0) {
      pdf.text(strings.empty, { size: 11 });
    } else {
      pdf.table(
        [
          { width: 1.4, header: strings.columns.date },
          { width: 3.4, header: strings.columns.description },
          { width: 1.2, header: strings.columns.charge, align: 'end' },
          { width: 1.2, header: strings.columns.payment, align: 'end' },
          { width: 1.4, header: strings.columns.balance, align: 'end' },
        ],
        statement.entries.map((entry) => {
          const minor = toMinorUnits(entry.amount);
          const description = entry.isReversal
            ? `${entry.description} (${strings.reversal})`.trim()
            : entry.description;

          return [
            formatDate(entry.occurredAt),
            description || describeKind(entry.kind, strings),
            entry.kind === LEDGER_ENTRY_KIND.CHARGE ? formatPlain(entry.amount) : '',
            entry.kind === LEDGER_ENTRY_KIND.PAYMENT ? formatPlain(negateText(minor)) : '',
            formatPlain(entry.runningBalance),
          ];
        }),
      );
    }

    pdf.space(10);
    pdf.rule();
    pdf.field(strings.closingBalance, formatAmount(statement.closingBalance, clinic.currency), {
      size: 13,
      dir: 'ltr',
    });

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

function describeKind(
  kind: Statement['entries'][number]['kind'],
  strings: DocumentStrings['statement'],
): string {
  return kind === LEDGER_ENTRY_KIND.PAYMENT ? strings.columns.payment : strings.columns.charge;
}

// Never `toLocaleString('ar')`: it wraps output in bidi control marks, which reorder the parts of a
// date laid out right-to-left.
function formatDate(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function formatPeriod(statement: Statement): string {
  const to = statement.to ? formatDate(statement.to) : formatDate(new Date().toISOString());

  return statement.from ? `${formatDate(statement.from)} – ${to}` : to;
}

function formatSequence(value: number): string {
  return String(value).padStart(6, '0');
}

function formatAmount(amount: Money, currency: string): string {
  return `${formatPlain(amount)} ${currency}`;
}

/** Money keeps its two decimals and its own sign; no thousands grouping. */
function formatPlain(amount: Money): string {
  return amount;
}

function negateText(minorUnits: number): Money {
  const absolute = Math.abs(minorUnits);

  return `${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}
