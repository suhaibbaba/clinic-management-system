import { Module } from "@nestjs/common";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { MeController } from "@api/modules/users/controllers/me.controller";
import { UsersController } from "@api/modules/users/controllers/users.controller";
import { UsersService } from "@api/modules/users/services/users.service";

@Module({
  controllers: [UsersController, MeController],
  providers: [UsersService, ClinicScopeService],
  exports: [UsersService],
})
export class UsersModule {}
