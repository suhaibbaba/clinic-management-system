import { Module } from '@nestjs/common';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { MeController } from '@api/users/me.controller';
import { UsersController } from '@api/users/users.controller';
import { UsersService } from '@api/users/users.service';

@Module({
  controllers: [UsersController, MeController],
  providers: [UsersService, ClinicScopeService],
  exports: [UsersService],
})
export class UsersModule {}
