import { Module } from "@nestjs/common";
import { ClinicsController } from "@api/clinics/clinics.controller";
import { ClinicsService } from "@api/clinics/clinics.service";
import { MapLinkResolver } from "@api/clinics/map-link.resolver";

@Module({
  controllers: [ClinicsController],
  providers: [ClinicsService, MapLinkResolver],
  exports: [ClinicsService],
})
export class ClinicsModule {}
