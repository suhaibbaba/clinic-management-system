import { Module } from '@nestjs/common';

import { ClinicsController } from '@api/clinics/clinics.controller';
import { ClinicsService } from '@api/clinics/clinics.service';

@Module({
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
