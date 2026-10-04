import { Inject, Injectable } from "@nestjs/common";
import { addMoney, subtractMoney, type Money } from "@clinic/shared";
import { and, eq, inArray } from "drizzle-orm";
import { documentDirection, documentStrings } from "@api/modules/billing/pdf/document-strings";
import { LetterheadService } from "@api/modules/billing/pdf/letterhead.service";
import {
  documentDateTime,
  documentMoney,
  fillPage,
} from "@api/modules/billing/pdf/document-format";
import { MUTED, RtlPdf } from "@api/modules/billing/pdf/pdf-builder";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { procedureCatalog } from "@api/database/schema";
import { procedureTeeth } from "@api/modules/patients/lib/plan-document";
import { PatientAccessService } from "@api/modules/patients/services/patient-access.service";
import { ProceduresService } from "@api/modules/patients/services/procedures.service";

@Injectable()
export class PatientDocumentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly letterheads: LetterheadService,
    private readonly patientAccess: PatientAccessService,
    private readonly procedures: ProceduresService,
  ) {}

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
