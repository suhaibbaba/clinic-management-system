import { Module } from "@nestjs/common";
import { AuditModule } from "@api/modules/audit/audit.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DatabaseModule } from "@api/database/database.module";
import { NotesController } from "@api/modules/notes/controllers/notes.controller";
import { NotesService } from "@api/modules/notes/services/notes.service";

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [NotesController],
  providers: [ClinicScopeService, NotesService],
})
export class NotesModule {}
