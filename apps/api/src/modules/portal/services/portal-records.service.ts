import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PortalFileLink, PortalRecord } from "@clinic/shared";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { toPersonName } from "@api/common/person-name";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  appointments,
  attachments,
  chartMarks,
  doctors,
  medicalHistories,
  patients,
  performedProcedures,
  prescriptions,
  procedureCatalog,
  users,
  visits,
} from "@api/database/schema";
import { LedgerService } from "@api/modules/billing/services/ledger.service";
import { StorageService } from "@api/modules/storage/services/storage.service";
import { PORTAL_RECORD_LIMIT } from "@api/modules/portal/constants";
import { phoneKeyOf } from "@api/modules/portal/lib/portal-code";
import {
  doctorUser,
  statementLine,
  teethByProcedure,
  toIso,
} from "@api/modules/portal/lib/portal-record";
import { type PortalSessionContext } from "@api/modules/portal/lib/portal-session";

@Injectable()
export class PortalRecordsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly storage: StorageService,
  ) {}

  async record(session: PortalSessionContext, patientId: string): Promise<PortalRecord> {
    const patient = await this.requirePatient(session, patientId);
    const { clinicId } = session;

    const [history, balance, statement, appointmentRows, procedureRows, visitRows, rxRows, files] =
      await Promise.all([
        this.db
          .select({
            allergies: medicalHistories.allergies,
            chronicConditions: medicalHistories.chronicConditions,
          })
          .from(medicalHistories)
          .where(
            and(
              eq(medicalHistories.clinicId, clinicId),
              eq(medicalHistories.patientId, patientId),
              isNull(medicalHistories.deletedAt),
            ),
          )
          .limit(1),
        this.ledger.balanceFor(clinicId, patientId),
        this.ledger.statementFor(clinicId, patientId, {}),
        this.db
          .select({
            id: appointments.id,
            startsAt: appointments.startsAt,
            durationMinutes: appointments.durationMinutes,
            status: appointments.status,
            nameAr: users.nameAr,
            nameEn: users.nameEn,
          })
          .from(appointments)
          .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
          .innerJoin(users, doctorUser)
          .where(
            and(
              eq(appointments.clinicId, clinicId),
              eq(appointments.patientId, patientId),
              isNull(appointments.deletedAt),
            ),
          )
          .orderBy(desc(appointments.startsAt))
          .limit(PORTAL_RECORD_LIMIT),
        this.db
          .select({
            id: performedProcedures.id,
            name: procedureCatalog.name,
            status: performedProcedures.status,
            performedAt: performedProcedures.performedAt,
            price: performedProcedures.price,
            discount: performedProcedures.discount,
            nameAr: users.nameAr,
            nameEn: users.nameEn,
          })
          .from(performedProcedures)
          .innerJoin(procedureCatalog, eq(procedureCatalog.id, performedProcedures.procedureId))
          .innerJoin(doctors, eq(doctors.id, performedProcedures.doctorId))
          .innerJoin(users, doctorUser)
          .where(
            and(
              eq(performedProcedures.clinicId, clinicId),
              eq(performedProcedures.patientId, patientId),
              isNull(performedProcedures.deletedAt),
            ),
          )
          .orderBy(desc(performedProcedures.performedAt))
          .limit(PORTAL_RECORD_LIMIT),
        this.db
          .select({
            id: visits.id,
            visitDate: visits.visitDate,
            complaint: visits.complaint,
            diagnosis: visits.diagnosis,
            nameAr: users.nameAr,
            nameEn: users.nameEn,
          })
          .from(visits)
          .innerJoin(doctors, eq(doctors.id, visits.doctorId))
          .innerJoin(users, doctorUser)
          .where(
            and(
              eq(visits.clinicId, clinicId),
              eq(visits.patientId, patientId),
              isNull(visits.deletedAt),
            ),
          )
          .orderBy(desc(visits.visitDate))
          .limit(PORTAL_RECORD_LIMIT),
        this.db
          .select({
            id: prescriptions.id,
            createdAt: prescriptions.createdAt,
            items: prescriptions.items,
            notes: prescriptions.notes,
            nameAr: users.nameAr,
            nameEn: users.nameEn,
          })
          .from(prescriptions)
          .innerJoin(doctors, eq(doctors.id, prescriptions.doctorId))
          .innerJoin(users, doctorUser)
          .where(
            and(
              eq(prescriptions.clinicId, clinicId),
              eq(prescriptions.patientId, patientId),
              isNull(prescriptions.deletedAt),
            ),
          )
          .orderBy(desc(prescriptions.createdAt))
          .limit(PORTAL_RECORD_LIMIT),
        this.db
          .select({
            id: attachments.id,
            filename: attachments.filename,
            mime: attachments.mime,
            sizeBytes: attachments.sizeBytes,
            tooth: attachments.tooth,
            createdAt: attachments.createdAt,
          })
          .from(attachments)
          .where(
            and(
              eq(attachments.clinicId, clinicId),
              eq(attachments.patientId, patientId),
              isNull(attachments.deletedAt),
            ),
          )
          .orderBy(desc(attachments.createdAt))
          .limit(PORTAL_RECORD_LIMIT),
      ]);

    const teeth = teethByProcedure(
      procedureRows.length === 0
        ? []
        : await this.db
            .select({ procedureId: chartMarks.performedProcedureId, tooth: chartMarks.tooth })
            .from(chartMarks)
            .where(
              and(
                eq(chartMarks.clinicId, clinicId),
                inArray(
                  chartMarks.performedProcedureId,
                  procedureRows.map((row) => row.id),
                ),
                isNull(chartMarks.deletedAt),
              ),
            ),
    );

    return {
      patient: {
        id: patient.id,
        fullName: patient.fullName,
        fileNumber: patient.fileNumber,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        allergies: history[0]?.allergies ?? [],
        chronicConditions: history[0]?.chronicConditions ?? [],
      },
      balance: { charged: balance.charged, paid: balance.paid, balance: balance.balance },
      appointments: appointmentRows.map((row) => ({
        id: row.id,
        startsAt: toIso(row.startsAt),
        durationMinutes: row.durationMinutes,
        status: row.status,
        doctor: toPersonName(row.nameAr, row.nameEn),
      })),
      treatments: procedureRows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        performedAt: toIso(row.performedAt),
        doctor: toPersonName(row.nameAr, row.nameEn),
        teeth: (teeth.get(row.id) ?? []).sort((a, b) => a - b),
        price: row.price,
        discount: row.discount,
      })),
      visits: visitRows.map((row) => ({
        id: row.id,
        visitDate: toIso(row.visitDate),
        doctor: toPersonName(row.nameAr, row.nameEn),
        complaint: row.complaint,
        diagnosis: row.diagnosis,
      })),
      prescriptions: rxRows.map((row) => ({
        id: row.id,
        createdAt: toIso(row.createdAt),
        doctor: toPersonName(row.nameAr, row.nameEn),
        items: row.items,
        notes: row.notes,
      })),
      statement: statement.entries.map(statementLine).reverse(),
      attachments: files.map((row) => ({ ...row, createdAt: toIso(row.createdAt) })),
    };
  }

  async fileLink(
    session: PortalSessionContext,
    patientId: string,
    attachmentId: string,
  ): Promise<PortalFileLink> {
    await this.requirePatient(session, patientId);

    const [file] = await this.db
      .select({ key: attachments.r2Key, filename: attachments.filename })
      .from(attachments)
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.clinicId, session.clinicId),
          eq(attachments.patientId, patientId),
          isNull(attachments.deletedAt),
        ),
      )
      .limit(1);

    if (!file) {
      throw new NotFoundException("File not found");
    }

    const link = await this.storage.createDownloadUrl(file.key, file.filename);

    return { url: link.url, expiresAt: link.expiresAt.toISOString() };
  }

  private async requirePatient(
    session: PortalSessionContext,
    patientId: string,
  ): Promise<typeof patients.$inferSelect> {
    const [patient] = await this.db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.id, patientId),
          eq(patients.clinicId, session.clinicId),
          isNull(patients.deletedAt),
          eq(phoneKeyOf(patients.phone), session.phone),
        ),
      )
      .limit(1);

    if (!patient) {
      throw new NotFoundException("Patient not found");
    }

    return patient;
  }
}
