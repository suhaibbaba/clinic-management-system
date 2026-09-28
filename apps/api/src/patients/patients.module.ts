import { Module } from "@nestjs/common";
import { BillingModule } from "@api/billing/billing.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import {
  AttachmentsController,
  PatientAttachmentsController,
} from "@api/patients/controllers/attachments.controller";
import { AttachmentsService } from "@api/patients/services/attachments.service";
import { MedicalHistoriesController } from "@api/patients/controllers/medical-histories.controller";
import { MedicalHistoriesService } from "@api/patients/services/medical-histories.service";
import { PatientAccessService } from "@api/patients/services/patient-access.service";
import { PatientRegistrationService } from "@api/patients/services/patient-registration.service";
import { PatientsController } from "@api/patients/controllers/patients.controller";
import { PatientsService } from "@api/patients/services/patients.service";
import { PrescriptionsController } from "@api/patients/controllers/prescriptions.controller";
import { PrescriptionsService } from "@api/patients/services/prescriptions.service";
import { ProcedureCatalogController } from "@api/patients/controllers/procedure-catalog.controller";
import { ProcedureCatalogService } from "@api/patients/services/procedure-catalog.service";
import { ProceduresController } from "@api/patients/controllers/procedures.controller";
import { ProceduresService } from "@api/patients/services/procedures.service";
import { TimelineController } from "@api/patients/controllers/timeline.controller";
import { TimelineService } from "@api/patients/services/timeline.service";
import { ToothHistoryController } from "@api/patients/controllers/tooth-history.controller";
import { ToothHistoryService } from "@api/patients/services/tooth-history.service";
import {
  PlanItemsController,
  TreatmentPlansController,
} from "@api/patients/controllers/treatment-plans.controller";
import { TreatmentPlansService } from "@api/patients/services/treatment-plans.service";
import { VisitsController } from "@api/patients/controllers/visits.controller";
import { VisitsService } from "@api/patients/services/visits.service";

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
    PatientRegistrationService,
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
  exports: [
    PatientAccessService,
    PatientRegistrationService,
    PatientsService,
    ProcedureCatalogService,
    TimelineService,
  ],
})
export class PatientsModule {}
