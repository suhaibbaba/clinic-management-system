import { Module } from "@nestjs/common";
import { ClinicsController } from "@api/modules/clinics/controllers/clinics.controller";
import { ClinicsService } from "@api/modules/clinics/services/clinics.service";
import { MapLinkResolver } from "@api/modules/clinics/services/map-link.resolver";

@Module({
  controllers: [ClinicsController],
  providers: [ClinicsService, MapLinkResolver],
  exports: [ClinicsService],
})
export class ClinicsModule {}
