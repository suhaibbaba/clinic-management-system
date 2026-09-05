import { Module } from '@nestjs/common';

import { BillingModule } from '@api/billing/billing.module';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import {
  AttachmentsController,
  PatientAttachmentsController,
} from '@api/patients/attachments.controller';
import { AttachmentsService } from '@api/patients/attachments.service';
import { MedicalHistoriesController } from '@api/patients/medical-histories.controller';
import { MedicalHistoriesService } from '@api/patients/medical-histories.service';
import { PatientAccessService } from '@api/patients/patient-access.service';
import { PatientsController } from '@api/patients/patients.controller';
import { PatientsService } from '@api/patients/patients.service';
import { PrescriptionsController } from '@api/patients/prescriptions.controller';
import { PrescriptionsService } from '@api/patients/prescriptions.service';
import { ProcedureCatalogController } from '@api/patients/procedure-catalog.controller';
import { ProcedureCatalogService } from '@api/patients/procedure-catalog.service';
import { ProceduresController } from '@api/patients/procedures.controller';
import { ProceduresService } from '@api/patients/procedures.service';
import { TimelineController } from '@api/patients/timeline.controller';
import { TimelineService } from '@api/patients/timeline.service';
import { ToothHistoryController } from '@api/patients/tooth-history.controller';
import { ToothHistoryService } from '@api/patients/tooth-history.service';
import {
  PlanItemsController,
  TreatmentPlansController,
} from '@api/patients/treatment-plans.controller';
import { TreatmentPlansService } from '@api/patients/treatment-plans.service';
import { VisitsController } from '@api/patients/visits.controller';
import { VisitsService } from '@api/patients/visits.service';

/**
 * The patient record and everything that hangs off it (CLAUDE.md module 2).
 *
 * The procedure catalog lives here too: billing owns it in the module order,
 * but treatment plan items and performed procedures both reference it, so it is
 * pulled forward rather than duplicated.
 */
@Module({
  imports: [BillingModule],
  controllers: [
    PatientsController,
    MedicalHistoriesController,
    VisitsController,
    ProceduresController,
    TreatmentPlansController,
    PlanItemsController,
    PatientAttachmentsController,
    AttachmentsController,
    ToothHistoryController,
    TimelineController,
    PrescriptionsController,
    ProcedureCatalogController,
  ],
  providers: [
    ClinicScopeService,
    PatientAccessService,
    PatientsService,
    MedicalHistoriesService,
    VisitsService,
    ProceduresService,
    TreatmentPlansService,
    AttachmentsService,
    ToothHistoryService,
    TimelineService,
    PrescriptionsService,
    ProcedureCatalogService,
  ],
  exports: [PatientAccessService, PatientsService, ProcedureCatalogService],
})
export class PatientsModule {}
