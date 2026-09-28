import { forwardRef, Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "@api/config/env.schema";
import { AccountEmailService } from "@api/modules/email/services/account-email.service";
import { EMAIL_PROVIDER } from "@api/modules/email/constants";
import { LogEmailProvider, ResendEmailProvider } from "@api/modules/email/services/email-provider";
import { type EmailProvider } from "@api/modules/email/lib/email-provider";
import { AccountInvitationsService } from "@api/modules/email/services/account-invitations.service";
import { AuthModule } from "@api/modules/auth/auth.module";
import { StorageModule } from "@api/modules/storage/storage.module";

@Global()
@Module({
  imports: [StorageModule, forwardRef(() => AuthModule)],
  providers: [
    LogEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService, LogEmailProvider],
      useFactory: (config: ConfigService<Env, true>, log: LogEmailProvider): EmailProvider =>
        config.get("EMAIL_PROVIDER", { infer: true }) === "resend"
          ? new ResendEmailProvider(config)
          : log,
    },
    AccountEmailService,
    AccountInvitationsService,
  ],
  exports: [AccountEmailService, AccountInvitationsService],
})
export class EmailModule {}
