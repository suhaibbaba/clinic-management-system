import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  personName,
  subtractMoney,
  type Money,
  type PayrollMonth,
  type SettlementQuery,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { documentDirection, documentStrings } from "@api/modules/billing/pdf/document-strings";
import { LetterheadService } from "@api/modules/billing/pdf/letterhead.service";
import {
  documentDate,
  documentDateTime,
  documentMoney,
  fillPage,
} from "@api/modules/billing/pdf/document-format";
import { MUTED, RtlPdf } from "@api/modules/billing/pdf/pdf-builder";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { doctors, users } from "@api/database/schema";
import { DoctorSettlementsService } from "@api/modules/payroll/services/doctor-settlements.service";
import { PayrollService } from "@api/modules/payroll/services/payroll.service";

@Injectable()
export class PayrollDocumentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly letterheads: LetterheadService,
    private readonly scope: ClinicScopeService,
    private readonly settlements: DoctorSettlementsService,
    private readonly payroll: PayrollService,
  ) {}

  async settlement(
    actor: AuthenticatedUser,
    doctorId: string,
    query: SettlementQuery,
  ): Promise<Buffer> {
    const settlement = await this.settlements.settlement(actor, doctorId, query);
    const clinic = await this.letterheads.load(actor.clinicId);
    const doctor = await this.doctorName(actor.clinicId, doctorId);
    const strings = documentStrings(clinic.language);
    const text = strings.settlement;
    const zone = clinic.timeZone;
    const money = (amount: Money): string => documentMoney(amount, clinic.currency);
    const day = (date: string): string => documentDate(`${date}T12:00:00Z`, zone);

    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    await this.letterheads.draw(pdf, clinic, text.title);
    pdf.footer((page, total) => fillPage(strings.common.page, page, total));

    pdf.infoGrid([
      { label: text.doctor, value: personName(doctor, clinic.language) },
      {
        label: text.period,
        value: `${day(settlement.from)} – ${day(settlement.to)}`,
        ltr: true,
      },
      { label: text.printedAt, value: documentDateTime(new Date().toISOString(), zone), ltr: true },
    ]);

    if (settlement.treatments.length === 0) {
      pdf.text(text.empty, { size: 11, colour: MUTED, align: "centre", gap: 12 });
    } else {
      pdf.table(
        [
          { width: 1.2, header: text.columns.date, ltr: true },
          { width: 1.8, header: text.columns.patient },
          { width: 1.9, header: text.columns.procedure },
          { width: 1.1, header: text.columns.amount, align: "end", ltr: true },
          { width: 1.1, header: text.columns.materials, align: "end", ltr: true },
          { width: 1.3, header: text.columns.clinicShare, align: "end", ltr: true },
          { width: 1.2, header: text.columns.doctorShare, align: "end", ltr: true },
        ],
        settlement.treatments.map((row) => [
          documentDate(row.performedAt, zone),
          row.patientName,
          row.procedureName,
          money(subtractMoney(row.price, row.discount)),
          money(row.materialCost),
          { text: money(row.clinicShare), sub: `${row.clinicSharePercent}%` },
          { text: money(row.doctorShare), weight: "medium" as const },
        ]),
        8.5,
      );
    }

    pdf.totals([
      { label: text.totalRevenue, value: money(settlement.totals.revenue) },
      { label: text.totalMaterials, value: money(settlement.totals.materials) },
      { label: text.totalClinicShare, value: money(settlement.totals.clinicShare) },
      { label: text.totalDoctorShare, value: money(settlement.totals.doctorShare) },
      { label: text.paid, value: money(settlement.paid) },
      { label: text.balance, value: money(settlement.balance), strong: true },
    ]);

    pdf.space(12);
    pdf.signatures([text.signatureClinic, text.signatureDoctor]);

    return pdf.save();
  }

  async month(actor: AuthenticatedUser, month: PayrollMonth): Promise<Buffer> {
    const payroll = await this.payroll.payroll(actor, month);
    const clinic = await this.letterheads.load(actor.clinicId);
    const strings = documentStrings(clinic.language);
    const text = strings.payroll;
    const money = (amount: Money): string => documentMoney(amount, clinic.currency);
    const [year, monthNumber] = payroll.month.split("-");

    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    await this.letterheads.draw(pdf, clinic, text.title);
    pdf.footer((page, total) => fillPage(strings.common.page, page, total));

    pdf.infoGrid([
      { label: text.month, value: `${monthNumber}/${year}`, ltr: true },
      {
        label: text.printedAt,
        value: documentDateTime(new Date().toISOString(), clinic.timeZone),
        ltr: true,
      },
    ]);

    if (payroll.lines.length === 0) {
      pdf.text(text.empty, { size: 11, colour: MUTED, align: "centre", gap: 12 });
    } else {
      pdf.table(
        [
          { width: 2.4, header: text.columns.employee },
          { width: 1.2, header: text.columns.salary, align: "end", ltr: true },
          { width: 1.1, header: text.columns.extras, align: "end", ltr: true },
          { width: 1.1, header: text.columns.cuts, align: "end", ltr: true },
          { width: 1.2, header: text.columns.due, align: "end", ltr: true },
          { width: 1.2, header: text.columns.paid, align: "end", ltr: true },
          { width: 1.2, header: text.columns.remaining, align: "end", ltr: true },
        ],
        payroll.lines.map((line) => [
          personName(line.name, clinic.language),
          money(line.base),
          money(line.extras),
          money(line.cuts),
          money(line.due),
          money(line.paid),
          { text: money(line.remaining), weight: "medium" as const },
        ]),
        8.5,
      );
    }

    pdf.totals([
      { label: text.totalDue, value: money(payroll.totals.due) },
      { label: text.totalPaid, value: money(payroll.totals.paid) },
      { label: text.totalRemaining, value: money(payroll.totals.remaining) },
      { label: text.visitingShares, value: money(payroll.visitingShares) },
      { label: text.staffCost, value: money(payroll.staffCost), strong: true },
    ]);

    pdf.space(12);
    pdf.signatures([text.signature]);

    return pdf.save();
  }

  private async doctorName(
    clinicId: string,
    doctorId: string,
  ): Promise<{ readonly ar: string; readonly en: string }> {
    const [row] = await this.db
      .select({ ar: users.nameAr, en: users.nameEn })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId))
      .where(this.scope.where(doctors, clinicId, eq(doctors.id, doctorId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return row;
  }
}
