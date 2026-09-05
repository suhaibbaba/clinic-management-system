import { Inject, Injectable } from '@nestjs/common';
import {
  CHART_TYPE,
  type ChartMark,
  type PerformedProcedure,
  type ToothHistory,
} from '@clinic/shared';
import { desc, eq, inArray } from 'drizzle-orm';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { chartMarks, performedProcedures } from '@api/database/schema';
import { AttachmentsService } from '@api/patients/attachments.service';
import { PatientAccessService } from '@api/patients/patient-access.service';
import { toChartMark, toProcedure } from '@api/patients/procedures.service';

/**
 * `GET /patients/:id/teeth/:fdi` — everything ever recorded on one tooth.
 *
 * The lookup starts from `chart_marks.tooth`, the column denormalised out of
 * the JSONB location precisely so this is an index scan; attachments carry
 * their own `tooth` column and are read alongside.
 *
 * Nothing dental leaks into a shared module: this service lives in `patients`
 * and the FDI number is validated by the shared schema, so another specialty
 * adds its own aggregation rather than a branch here.
 */
@Injectable()
export class ToothHistoryService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly attachments: AttachmentsService,
  ) {}

  async get(actor: AuthenticatedUser, patientId: string, tooth: number): Promise<ToothHistory> {
    await this.patientAccess.requirePatientId(actor, patientId);

    const markRows = await this.db
      .select()
      .from(chartMarks)
      .innerJoin(performedProcedures, eq(chartMarks.performedProcedureId, performedProcedures.id))
      .where(
        this.scope.where(
          chartMarks,
          actor.clinicId,
          eq(chartMarks.tooth, tooth),
          eq(chartMarks.chartType, CHART_TYPE.TOOTH_FDI),
          eq(performedProcedures.patientId, patientId),
        ),
      );

    const marks: ChartMark[] = markRows.map((row) => toChartMark(row.chart_marks));
    const procedureIds = [...new Set(marks.map((mark) => mark.performedProcedureId))];

    const [procedures, toothAttachments] = await Promise.all([
      this.proceduresFor(actor, procedureIds, marks),
      this.attachments.listForTooth(actor, patientId, tooth),
    ]);

    return { patientId, tooth, procedures, marks, attachments: toothAttachments };
  }

  /** Each procedure is returned with only the marks that touch this tooth. */
  private async proceduresFor(
    actor: AuthenticatedUser,
    procedureIds: readonly string[],
    marks: readonly ChartMark[],
  ): Promise<PerformedProcedure[]> {
    if (procedureIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(performedProcedures)
      .where(
        this.scope.where(
          performedProcedures,
          actor.clinicId,
          inArray(performedProcedures.id, [...procedureIds]),
        ),
      )
      .orderBy(desc(performedProcedures.performedAt));

    return rows.map((row) =>
      toProcedure(
        row,
        marks.filter((mark) => mark.performedProcedureId === row.id),
      ),
    );
  }
}
