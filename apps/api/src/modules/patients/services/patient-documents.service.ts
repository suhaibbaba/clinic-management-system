import { Inject, Injectable } from "@nestjs/common";
import { addMoney, personName, subtractMoney, type Money } from "@clinic/shared";
import { and, eq, inArray } from "drizzle-orm";
import { documentDirection, documentStrings } from "@api/modules/billing/pdf/document-strings";
import { LetterheadService } from "@api/modules/billing/pdf/letterhead.service";
import {
  documentDate,
  documentDateTime,
  documentMoney,
  fillPage,
} from "@api/modules/billing/pdf/document-format";
import { MUTED, RtlPdf } from "@api/modules/billing/pdf/pdf-builder";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { doctors, procedureCatalog, users, visits } from "@api/database/schema";
import { procedureTeeth } from "@api/modules/patients/lib/plan-document";
import { prescriptionRow } from "@api/modules/patients/lib/prescription-document";
import { PatientAccessService } from "@api/modules/patients/services/patient-access.service";
import { PrescriptionsService } from "@api/modules/patients/services/prescriptions.service";
import { ProceduresService } from "@api/modules/patients/services/procedures.service";

@Injectable()
export class PatientDocumentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly letterheads: LetterheadService,
    private readonly patientAccess: PatientAccessService,
    private readonly procedures: ProceduresService,
    private readonly prescriptions: PrescriptionsService,
  ) {}

  async prescription(actor: AuthenticatedUser, prescriptionId: string): Promise<Buffer> {
    const prescription = await this.prescriptions.findOne(actor, prescriptionId);
    const patient = await this.patientAccess.requirePatient(actor, prescription.patientId);
    const clinic = await this.letterheads.load(actor.clinicId);
    const strings = documentStrings(clinic.language);
    const text = strings.prescription;

    const [doctor] = await this.db
      .select({ nameAr: users.nameAr, nameEn: users.nameEn })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId))
      .where(and(eq(doctors.id, prescription.doctorId), eq(doctors.clinicId, actor.clinicId)))
      .limit(1);

    const [visit] = prescription.visitId
      ? await this.db
          .select({ visitDate: visits.visitDate })
          .from(visits)
          .where(and(eq(visits.id, prescription.visitId), eq(visits.clinicId, actor.clinicId)))
          .limit(1)
      : [];

    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    await this.letterheads.draw(pdf, clinic, text.title);
    pdf.footer((page, total) => fillPage(strings.common.page, page, total));

    pdf.infoGrid([
      { label: text.patient, value: patient.fullName },
      { label: text.fileNumber, value: patient.fileNumber, ltr: true },
      {
        label: text.doctor,
        value: doctor
          ? personName({ ar: doctor.nameAr, en: doctor.nameEn }, clinic.language)
          : "--",
      },
      {
        label: text.date,
        value: documentDate(
          visit?.visitDate.toISOString() ?? prescription.createdAt,
          clinic.timeZone,
        ),
        ltr: true,
      },
    ]);

    pdf.table(
      [
        { width: 0.5, header: text.columns.number, ltr: true },
        { width: 3.6, header: text.columns.drug },
        { width: 1.3, header: text.columns.perDose, ltr: true },
        { width: 1.3, header: text.columns.timesPerDay, ltr: true },
        { width: 1.3, header: text.columns.duration },
      ],
      prescription.items.map((item, index) => prescriptionRow(item, index, text)),
      10,
    );

    if (prescription.notes) {
      pdf.text(text.notes, { size: 11, weight: "bold", gap: 2 });
      pdf.text(prescription.notes, { size: 10.5, gap: 12 });
    }

    pdf.space(12);
    pdf.signatures([text.signatureDoctor]);

    return pdf.save();
  }

  async treatmentPlan(actor: AuthenticatedUser, patientId: string): Promise<Buffer> {
    const patient = await this.patientAccess.requirePatient(actor, patientId);
    const plan = await this.procedures.planFor(actor, patientId);
    const clinic = await this.letterheads.load(actor.clinicId);
    const strings = documentStrings(clinic.language);
    const text = strings.treatmentPlan;
    const names = await this.procedureNames(
      actor.clinicId,
      plan.map((item) => item.procedureId),
    );

    const pdf = await RtlPdf.create({ direction: documentDirection(clinic.language) });

    await this.letterheads.draw(pdf, clinic, text.title);
    pdf.footer((page, total) => fillPage(strings.common.page, page, total));

    pdf.infoGrid([
      { label: text.patient, value: patient.fullName },
      { label: text.fileNumber, value: patient.fileNumber, ltr: true },
      {
        label: text.printedAt,
        value: documentDateTime(new Date().toISOString(), clinic.timeZone),
        ltr: true,
      },
    ]);

    if (plan.length === 0) {
      pdf.text(text.empty, { size: 11, colour: MUTED, align: "centre", gap: 12 });
    } else {
      pdf.table(
        [
          { width: 0.5, header: text.columns.number, ltr: true },
          { width: 4, header: text.columns.procedure },
          { width: 1.4, header: text.columns.status },
          { width: 1.6, header: text.columns.price, align: "end", ltr: true },
        ],
        plan.map((item, index) => {
          const teeth = procedureTeeth(item);

          return [
            String(index + 1),
            {
              text: names.get(item.procedureId) ?? text.columns.procedure,
              sub: teeth.length > 0 ? `${text.columns.teeth}: ${teeth.join(", ")}` : undefined,
            },
            text.statuses[item.status as keyof typeof text.statuses] ?? item.status,
            documentMoney(subtractMoney(item.price, item.discount), clinic.currency),
          ];
        }),
      );

      pdf.totals([
        {
          label: text.total,
          value: documentMoney(
            plan.reduce<Money>(
              (total, item) => addMoney(total, subtractMoney(item.price, item.discount)),
              "0.00",
            ),
            clinic.currency,
          ),
          strong: true,
        },
      ]);
    }

    pdf.text(text.disclaimer, { size: 9, colour: MUTED, gap: 12 });
    pdf.space(12);
    pdf.signatures([text.signatureDoctor, text.signaturePatient]);

    return pdf.save();
  }

  private async procedureNames(
    clinicId: string,
    ids: readonly string[],
  ): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({ id: procedureCatalog.id, name: procedureCatalog.name })
      .from(procedureCatalog)
      .where(and(eq(procedureCatalog.clinicId, clinicId), inArray(procedureCatalog.id, [...ids])));

    return new Map(rows.map((row) => [row.id, row.name]));
  }
}
