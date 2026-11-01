import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SubscriptionsService } from "@api/modules/vendor/services/subscriptions.service";

@Injectable()
export class SubscriptionExpiryScheduler {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    await this.subscriptions.advance();
  }
}
