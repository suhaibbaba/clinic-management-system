import { Module } from '@nestjs/common';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { DoctorsController } from '@api/doctors/doctors.controller';
import { DoctorsService } from '@api/doctors/doctors.service';

@Module({
  controllers: [DoctorsController],
  providers: [DoctorsService, ClinicScopeService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
