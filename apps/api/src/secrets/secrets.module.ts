import { Module } from "@nestjs/common";
import { AppConfigModule } from "@api/config/config.module";
import { DatabaseModule } from "@api/database/database.module";
import { SecretsController } from "@api/secrets/secrets.controller";
import { SecretsService } from "@api/secrets/secrets.service";

@Module({
  imports: [DatabaseModule, AppConfigModule],
  controllers: [SecretsController],
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SecretsModule {}
