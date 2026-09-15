import { forwardRef, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '@api/config/env.schema';
import { AccountEmailService } from '@api/email/account-email.service';
import {
  EMAIL_PROVIDER,
  LogEmailProvider,
  ResendEmailProvider,
  type EmailProvider,
} from '@api/email/email-provider';
import { AccountInvitationsService } from '@api/email/account-invitations.service';
import { AuthModule } from '@api/auth/auth.module';
import { StorageModule } from '@api/storage/storage.module';

// Global, as the notifications module is: two feature modules send these letters and neither owns
// them.
@Global()
@Module({
  imports: [StorageModule, forwardRef(() => AuthModule)],
  providers: [
    LogEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService, LogEmailProvider],
      useFactory: (config: ConfigService<Env, true>, log: LogEmailProvider): EmailProvider =>
        config.get('EMAIL_PROVIDER', { infer: true }) === 'resend'
          ? new ResendEmailProvider(config)
          : log,
    },
    AccountEmailService,
    AccountInvitationsService,
  ],
  exports: [AccountEmailService, AccountInvitationsService],
})
export class EmailModule {}
