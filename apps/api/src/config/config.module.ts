import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnv } from "@api/config/env.schema";

/** Read values with `config.get('PORT', { infer: true })` for full type inference. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [".env", "../../.env"],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
