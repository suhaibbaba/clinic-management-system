import { Module } from "@nestjs/common";
import { BillingModule } from "@api/modules/billing/billing.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import {
  AttachmentsController,
  PatientAttachmentsController,
} from "@api/modules/patients/controllers/attachments.controller";
import { AttachmentsService } from "@api/modules/patients/services/attachments.service";
import { MedicalHistoriesController } from "@api/modules/patients/controllers/medical-histories.controller";
import { MedicalHistoriesService } from "@api/modules/patients/services/medical-histories.service";
import { PatientAccessService } from "@api/modules/patients/services/patient-access.service";
import { PatientRegistrationService } from "@api/modules/patients/services/patient-registration.service";
import { PatientsController } from "@api/modules/patients/controllers/patients.controller";
import { PatientsService } from "@api/modules/patients/services/patients.service";
import { PrescriptionsController } from "@api/modules/patients/controllers/prescriptions.controller";
import { PrescriptionsService } from "@api/modules/patients/services/prescriptions.service";
import { ProcedureCatalogController } from "@api/modules/patients/controllers/procedure-catalog.controller";
import { ProcedureCatalogService } from "@api/modules/patients/services/procedure-catalog.service";
import { ProceduresController } from "@api/modules/patients/controllers/procedures.controller";
import { ProceduresService } from "@api/modules/patients/services/procedures.service";
import { TimelineController } from "@api/modules/patients/controllers/timeline.controller";
import { TimelineService } from "@api/modules/patients/services/timeline.service";
import { ToothHistoryController } from "@api/modules/patients/controllers/tooth-history.controller";
import { ToothHistoryService } from "@api/modules/patients/services/tooth-history.service";
import { TreatmentPlansController } from "@api/modules/patients/controllers/treatment-plans.controller";
import { TreatmentPlansService } from "@api/modules/patients/services/treatment-plans.service";
import { VisitsController } from "@api/modules/patients/controllers/visits.controller";
import { VisitsService } from "@api/modules/patients/services/visits.service";

@Module({
  imports: [BillingModule],
  controllers: [
    PatientsController,
    MedicalHistoriesController,
    VisitsController,
    ProceduresController,
    TreatmentPlansController,
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
