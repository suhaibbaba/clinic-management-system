import { Body, Controller, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { type FastifyReply, type FastifyRequest } from "fastify";
import { siteSlugParamSchema, type ContactMessageReceipt, type PublicSite } from "@clinic/shared";
import { Public } from "@api/common/decorators/public.decorator";
import { WebsiteService } from "@api/modules/website/services/website.service";
import { ContactMessagesService } from "@api/modules/website/services/contact-messages.service";
import { SITE_HEAD_MAX_AGE_SECONDS } from "@api/modules/website/constants";
import { CreateContactMessageDto, SiteSlugParamDto } from "@api/modules/website/dto/website.dto";

@Controller("public/site")
@Public()
export class PublicSiteController {
  constructor(
    private readonly website: WebsiteService,
    private readonly messages: ContactMessagesService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  byHost(@Req() request: FastifyRequest): Promise<PublicSite> {
    return this.website.publicByHost(request.hostname);
  }

  @Get("head")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async head(
    @Req() request: FastifyRequest,
    @Query("slug") slug: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const parsed = siteSlugParamSchema.safeParse({ clinicSlug: slug });

    reply
      .type("text/html; charset=utf-8")
      .header("cache-control", `public, max-age=${SITE_HEAD_MAX_AGE_SECONDS}`)
      .send(
        await this.website.headByHost(
          request.hostname,
          parsed.success ? parsed.data.clinicSlug : undefined,
        ),
      );
  }

  @Get(":clinicSlug")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  bySlug(@Param() params: SiteSlugParamDto): Promise<PublicSite> {
    return this.website.publicBySlug(params.clinicSlug);
  }

  @Post(":clinicSlug/messages")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  sendMessage(
    @Param() params: SiteSlugParamDto,
    @Body() body: CreateContactMessageDto,
  ): Promise<ContactMessageReceipt> {
    return this.messages.create(params.clinicSlug, body);
  }
}
