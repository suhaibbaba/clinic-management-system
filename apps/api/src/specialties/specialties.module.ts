import { Module } from '@nestjs/common';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { SpecialtiesController } from '@api/specialties/specialties.controller';
import { SpecialtiesService } from '@api/specialties/specialties.service';

@Module({
  controllers: [SpecialtiesController],
  providers: [SpecialtiesService, ClinicScopeService],
  exports: [SpecialtiesService],
})
export class SpecialtiesModule {}
