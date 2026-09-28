import { Module } from "@nestjs/common";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { SpecialtiesController } from "@api/modules/specialties/controllers/specialties.controller";
import { SpecialtiesService } from "@api/modules/specialties/services/specialties.service";

@Module({
  controllers: [SpecialtiesController],
  providers: [SpecialtiesService, ClinicScopeService],
  exports: [SpecialtiesService],
})
export class SpecialtiesModule {}
