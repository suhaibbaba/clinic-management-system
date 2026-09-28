import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { RequestWithUser } from "@api/common/types/authenticated-user";

@Injectable()
export class RequestThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: Record<string, unknown>): Promise<string> {
    const user = (request as unknown as RequestWithUser).user;

    return user ? `user:${user.id}` : `ip:${String(request["ip"])}`;
  }
}
