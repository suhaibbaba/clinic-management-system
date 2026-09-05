import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  LEDGER_ENTRY_KIND,
  toMinorUnits,
  type Money,
  type PaymentMethod,
  type Statement,
  type StatementQuery,
} from '@clinic/shared';
import { eq } from 'drizzle-orm';

import { LedgerService } from '@api/billing/ledger.service';
import { toPayment } from '@api/billing/payments.service';
import { BRAND_MARK, MARK_VIEWBOX } from '@api/billing/pdf/brand-mark';
import { DOCUMENT_STRINGS } from '@api/billing/pdf/document-strings';
import { A4, RtlPdf } from '@api/billing/pdf/pdf-builder';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { clinics, payments } from '@api/database/schema';
import { PatientAccessService } from '@api/patients/patient-access.service';

/**
 * Technical values — a phone number, a date, a receipt number, an amount with
 * its currency — read left to right in an Arabic document just as they do
 * anywhere else. Marking them keeps a leading `+` on the left and stops the
 * bidi algorithm swapping the two ends of a date range.
 */
const LTR = { dir: 'ltr' } as const;

interface Letterhead {
  readonly name: string;
  readonly contact: string;
  readonly currency: string;
}

/**
 * The printable documents: a receipt for every payment, and a patient
 * statement.
 *
 * Rendered with pdf-lib and an Amiri font embedded whole — no headless browser,
 * because the API container is meant to run on a cheap VPS and a Chromium next
 * to Node would roughly triple its memory (CLAUDE.md target infra). The Arabic
 * shaping and bidi ordering live in `pdf/`.
 */
@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
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
    const clinic = await this.letterhead(actor.clinicId);
    const balance = await this.ledger.balanceFor(actor.clinicId, payment.patientId);

    const reversesId = payment.reversesId;
    const isReversal = reversesId !== null;
    const reversedNumber = reversesId === null ? null : await this.receiptNumberOf(reversesId);

    const strings = DOCUMENT_STRINGS.receipt;
    const pdf = await RtlPdf.create({ width: A4.width, height: A4.height / 2 });

    this.drawLetterhead(pdf, clinic);
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
    pdf.field(strings.method, DOCUMENT_STRINGS.methods[payment.method as PaymentMethod]);

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
    const clinic = await this.letterhead(actor.clinicId);
    const statement = await this.ledger.statementFor(actor.clinicId, patientId, query);

    const strings = DOCUMENT_STRINGS.statement;
    const pdf = await RtlPdf.create();

    this.drawLetterhead(pdf, clinic);
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
            description || describeKind(entry.kind),
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

  private drawLetterhead(pdf: RtlPdf, clinic: Letterhead): void {
    // The mark, then the clinic's own name: the sheet is the clinic's, and the
    // brand sits above it rather than in place of it. Both are centred so a
    // long Arabic name and a short one produce the same letterhead.
    pdf.mark(BRAND_MARK, MARK_VIEWBOX);

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

  private async letterhead(clinicId: string): Promise<Letterhead> {
    const [row] = await this.db
      .select({
        name: clinics.name,
        phone: clinics.phone,
        address: clinics.address,
        currency: clinics.currency,
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
    };
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

function describeKind(kind: Statement['entries'][number]['kind']): string {
  return kind === LEDGER_ENTRY_KIND.PAYMENT
    ? DOCUMENT_STRINGS.statement.columns.payment
    : DOCUMENT_STRINGS.statement.columns.charge;
}

/**
 * Latin digits with an explicit separator, never `toLocaleString('ar')`: an
 * Arabic locale wraps its output in bidi control marks, and those reorder the
 * parts of a date once the string is laid out right-to-left.
 */
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
