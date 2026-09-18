import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import {
  AUDIT_ACTION,
  confirmClinicAppIconSchema,
  confirmClinicLogoSchema,
  presignClinicAppIconSchema,
  presignClinicLogoSchema,
  resolveLocationSchema,
  updateClinicSchema,
  USER_ROLE,
  type Clinic,
  type ClinicBranding,
  type PresignClinicIconsResponse,
  type PresignClinicLogoResponse,
  type ResolvedLocation,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CLINICS_ENTITY, ClinicsService } from "@api/clinics/clinics.service";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { MapLinkResolver } from "@api/clinics/map-link.resolver";
import { Public } from "@api/common/decorators/public.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";

// Short: the signed URL behind the redirect lasts days, so this only decides how often a browser
// asks again after the clinic changes its logo.
const ICON_MAX_AGE_SECONDS = 300;

// Short as well: a clinic that renames itself should see the home screen follow within the hour,
// and the document is a few hundred bytes.
const MANIFEST_MAX_AGE_SECONDS = 300;

class UpdateClinicDto extends createZodDto(updateClinicSchema) {}
class PresignLogoDto extends createZodDto(presignClinicLogoSchema) {}
class ConfirmLogoDto extends createZodDto(confirmClinicLogoSchema) {}
class PresignAppIconDto extends createZodDto(presignClinicAppIconSchema) {}
class ConfirmAppIconDto extends createZodDto(confirmClinicAppIconSchema) {}
class ResolveLocationDto extends createZodDto(resolveLocationSchema) {}

@Controller("clinic")
export class ClinicsController {
  constructor(
    private readonly clinicsService: ClinicsService,
    private readonly mapLinks: MapLinkResolver,
  ) {}

  @Get("branding")
  @Public()
  branding(): Promise<ClinicBranding> {
    return this.clinicsService.branding();
  }

  // Per clinic, because a home screen shows the clinic's name rather than the product's. Public
  // and same-origin: a browser fetches a manifest without a token, and `start_url` is resolved
  // against it.
  @Get("manifest.webmanifest")
  @Public()
  async manifest(@Res() reply: FastifyReply): Promise<void> {
    reply
      .type("application/manifest+json")
      .header("cache-control", `public, max-age=${MANIFEST_MAX_AGE_SECONDS}`)
      .send(await this.clinicsService.manifest());
  }

  // The tab mark and the home-screen icons: public because a browser fetches a favicon and a
  // manifest icon with no token, and a redirect rather than a proxy so the bytes still never pass
  // through the API. The signed URL is window-stable, so the browser caches it like any image.
  @Get("icon/:name")
  @Public()
  async icon(@Param("name") name: string, @Res() reply: FastifyReply): Promise<void> {
    const url = await this.clinicsService.iconUrl(name);

    if (!url) {
      throw new NotFoundException("Resource not found");
    }

    reply
      .header("cache-control", `public, max-age=${ICON_MAX_AGE_SECONDS}`)
      .redirect(url, HttpStatus.FOUND);
  }

  @Get()
  get(@CurrentUser() actor: AuthenticatedUser): Promise<Clinic> {
    return this.clinicsService.get(actor);
  }

  @Patch()
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINICS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  update(@CurrentUser() actor: AuthenticatedUser, @Body() body: UpdateClinicDto): Promise<Clinic> {
    return this.clinicsService.update(actor, body);
  }

  // Not audited and nothing is written: this only turns a link somebody pasted into two numbers,
  // which they then choose to save or not. Admin-only because clinic settings are.
  @Post("location/resolve")
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLE.ADMIN)
  resolveLocation(@Body() body: ResolveLocationDto): Promise<ResolvedLocation> {
    return this.mapLinks.resolve(body.url);
  }

  // Not audited: nothing has changed yet, and a signature the browser never uses leaves no trace
  // worth keeping.
  @Post("logo/presign")
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLE.ADMIN)
  presignLogo(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: PresignLogoDto,
  ): Promise<PresignClinicLogoResponse> {
    return this.clinicsService.presignLogo(actor, body);
  }

  @Post("logo")
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINICS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  confirmLogo(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ConfirmLogoDto,
  ): Promise<Clinic> {
    return this.clinicsService.confirmLogo(actor, body);
  }

  @Delete("logo")
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINICS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  removeLogo(@CurrentUser() actor: AuthenticatedUser): Promise<Clinic> {
    return this.clinicsService.removeLogo(actor);
  }

  @Post("app-icon/presign")
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLE.ADMIN)
  presignAppIcon(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: PresignAppIconDto,
  ): Promise<PresignClinicLogoResponse> {
    return this.clinicsService.presignAppIcon(actor, body);
  }

  @Post("app-icon")
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINICS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  confirmAppIcon(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ConfirmAppIconDto,
  ): Promise<Clinic> {
    return this.clinicsService.confirmAppIcon(actor, body);
  }

  @Delete("app-icon")
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINICS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  removeAppIcon(@CurrentUser() actor: AuthenticatedUser): Promise<Clinic> {
    return this.clinicsService.removeAppIcon(actor);
  }

  // Its own step rather than part of either upload, because the set is re-rendered whenever the
  // picture it comes from changes — including when removing the app icon falls back to the logo.
  @Post("branding/icons/presign")
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLE.ADMIN)
  presignIcons(@CurrentUser() actor: AuthenticatedUser): Promise<PresignClinicIconsResponse> {
    return this.clinicsService.presignIcons(actor);
  }

  @Post("branding/icons")
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINICS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  confirmIcons(@CurrentUser() actor: AuthenticatedUser): Promise<Clinic> {
    return this.clinicsService.confirmIcons(actor);
  }
}
