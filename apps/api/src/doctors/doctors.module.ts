import { Module } from "@nestjs/common";
import { AuthModule } from "@api/auth/auth.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DoctorsController } from "@api/doctors/controllers/doctors.controller";
import { DoctorsService } from "@api/doctors/services/doctors.service";
import { UsersModule } from "@api/users/users.module";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [DoctorsController],
  providers: [DoctorsService, ClinicScopeService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
