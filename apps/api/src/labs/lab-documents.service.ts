import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  LAB_STATEMENT_ENTRY_KIND,
  personName,
  type LabStatement,
  type Money,
  type StatementQuery,
} from '@clinic/shared';
import { eq } from 'drizzle-orm';

import { documentDirection, documentStrings } from '@api/billing/pdf/document-strings';
import { LetterheadService } from '@api/billing/pdf/letterhead.service';
import { RtlPdf } from '@api/billing/pdf/pdf-builder';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { doctors, labWorkTypes, labs, patients, users } from '@api/database/schema';
import { labOrders } from '@api/database/schema';
import { LabLedgerService } from '@api/labs/lab-ledger.service';

/** Technical values read left to right even inside an Arabic document. */
const LTR = { dir: 'ltr' } as const;

// The order sheet carries the patient's first name only: it leaves the building in a box, handled
// by people who are not clinic staff.
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
        workTypeName: labWorkTypes.nameAr,
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
      throw new NotFoundException('Resource not found');
    }

    const clinic = await this.letterheads.load(actor.clinicId);
    const strings = documentStrings(clinic.language).labOrder;
    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    await this.letterheads.draw(pdf, clinic);
    pdf.text(strings.title, { size: 16, weight: 'bold', align: 'centre', gap: 14 });

    pdf.field(strings.lab, row.labName);
    pdf.field(strings.number, shortId(row.order.id), LTR);
    pdf.field(strings.date, formatDate(new Date().toISOString()), LTR);
    pdf.space(6);

    pdf.field(strings.patient, firstName(row.patientName));
    pdf.field(
      strings.doctor,
      personName({ ar: row.doctorNameAr, en: row.doctorNameEn }, clinic.language),
    );
    pdf.space(6);

    pdf.field(strings.workType, row.workTypeName ?? '—');
    pdf.field(strings.teeth, row.order.teeth.length > 0 ? row.order.teeth.join('، ') : '—', LTR);
    pdf.field(strings.material, row.order.material ?? '—');
    pdf.field(strings.shade, row.order.shade ?? '—', LTR);
    pdf.field(
      strings.expected,
      row.order.expectedAt ? formatDate(row.order.expectedAt.toISOString()) : '—',
      LTR,
    );

    if (row.order.instructions) {
      pdf.space(8);
      pdf.text(strings.instructions, { size: 12, weight: 'bold', gap: 4 });
      pdf.text(row.order.instructions, { size: 11 });
    }

    pdf.space(28);
    pdf.rule();
    pdf.text(`${strings.signature}: ____________________`, { size: 10 });

    return pdf.save();
  }

  async statement(actor: AuthenticatedUser, labId: string, query: StatementQuery): Promise<Buffer> {
    const clinic = await this.letterheads.load(actor.clinicId);
    const statement = await this.ledger.statementFor(actor.clinicId, labId, query);

    const strings = documentStrings(clinic.language).labStatement;
    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    await this.letterheads.draw(pdf, clinic);
    pdf.text(strings.title, { size: 16, weight: 'bold', align: 'centre', gap: 14 });

    pdf.field(strings.lab, statement.labName);
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
          { width: 1.2, header: strings.columns.order, align: 'end' },
          { width: 1.2, header: strings.columns.payment, align: 'end' },
          { width: 1.4, header: strings.columns.balance, align: 'end' },
        ],
        statement.entries.map((entry) => {
          const isPayment = entry.kind === LAB_STATEMENT_ENTRY_KIND.PAYMENT;
          const description = entry.isReversal
            ? `${entry.description} (${strings.reversal})`.trim()
            : entry.description;

          return [
            formatDate(entry.occurredAt),
            description || (isPayment ? strings.columns.payment : strings.columns.order),
            isPayment ? '' : entry.amount,
            // Payments are stored negated in the statement's arithmetic; the
            // column shows what was handed over, which is the positive of it.
            isPayment ? entry.amount.replace('-', '') : '',
            entry.runningBalance,
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
}

/** Enough of the id to match a box to a record, short enough to read aloud. */
const shortId = (id: string): string => id.slice(0, 8).toUpperCase();

const firstName = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? fullName;

function formatDate(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function formatPeriod(statement: LabStatement): string {
  const to = statement.to ? formatDate(statement.to) : formatDate(new Date().toISOString());

  return statement.from ? `${formatDate(statement.from)} – ${to}` : to;
}

function formatAmount(amount: Money, currency: string): string {
  return `${amount} ${currency}`;
}
