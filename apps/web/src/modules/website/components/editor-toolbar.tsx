import {
  canDisablePage,
  LANGUAGE_DEFINITIONS,
  SITE_PAGE_KIND,
  type LanguageCode,
  type SitePage,
  type SitePageKind,
} from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Icon, InfoTip, SegmentedControl, Select, Switch } from "@clinic/ui";
import { Logo } from "@web/shared/components/brand/logo";
import { useClinicLogo } from "@web/shared/hooks/use-clinic-logo";
import { formatDateTime } from "@web/shared/lib/format";
import { useSession } from "@web/shared/providers/session";
import { OpenSiteLink } from "@web/modules/website/components/open-site-link";
import { PREVIEW_DEVICE_DESKTOP, PREVIEW_DEVICE_MOBILE } from "@web/modules/website/constants";

export interface EditorToolbarProps {
  readonly pages: readonly SitePage[];
  readonly kind: SitePageKind;
  readonly onKind: (kind: SitePageKind) => void;
  readonly onPageEnabled: (enabled: boolean) => void;
  readonly bookingAvailable: boolean;
  readonly language: LanguageCode;
  readonly languages: readonly LanguageCode[];
  readonly onLanguage: (language: LanguageCode) => void;
  readonly mobile: boolean;
  readonly onMobile: (mobile: boolean) => void;
  readonly onSettings: () => void;
  readonly publishedAt: string | null;
  readonly liveHref: string;
  readonly dirty: boolean;
  readonly unpublished: boolean;
  readonly invalid: boolean;
  readonly onShowProblem: () => void;
  readonly saving: boolean;
  readonly publishing: boolean;
  readonly onSave: () => void;
  readonly onPublish: () => void;
  readonly onExit: () => void;
}

export function EditorToolbar(props: EditorToolbarProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const logoUrl = useClinicLogo(user?.clinicId, user?.clinic.logoUrl);
  const { pages, kind, language, languages, mobile, publishedAt } = props;
  const page = pages.find((candidate) => candidate.kind === kind);
  const blockedBooking = kind === SITE_PAGE_KIND.BOOKING && !props.bookingAvailable;

  return (
    <section
      data-testid="editor-toolbar"
      aria-label={t("website.editor.toolbar")}
      className="relative z-10 flex shrink-0 items-center gap-3 overflow-x-auto border-b border-line bg-surface px-3 py-2 whitespace-nowrap shadow-card"
    >
      <span data-part="brand" className="flex shrink-0 items-center gap-2">
        <Logo
          size="toolbar"
          src={logoUrl}
          name={user?.clinic.name}
          alt={t("app.title")}
          className="mx-0"
        />
        <h1 className="sr-only">{t("website.editor.title")}</h1>
      </span>
      <div data-part="canvas" className="flex shrink-0 items-center gap-2">
        <Select
          aria-label={t("website.preview.page")}
          data-testid="editor-toolbar-page"
          className="w-44"
          value={kind}
          options={pages.map((candidate) => ({
            value: candidate.kind,
            label: t(`website.preview.pages.${candidate.kind}`),
          }))}
          onChange={(event) => props.onKind(event.target.value as SitePageKind)}
        />
        <span data-part="page-enabled" className="inline-flex items-center gap-1">
          <Switch
            data-testid="editor-toolbar-page-enabled"
            checked={(page?.enabled ?? false) && !blockedBooking}
            aria-disabled={!canDisablePage(kind) || blockedBooking}
            label={t("website.editor.pageShown")}
            onCheckedChange={props.onPageEnabled}
          />
          {blockedBooking && (
            <InfoTip data-testid="editor-toolbar-booking-off" label={t("common.moreInfo")}>
              {t("website.editor.bookingOff")}
            </InfoTip>
          )}
        </span>
        {languages.length > 1 && (
          <Select
            aria-label={t("website.editor.language")}
            data-testid="editor-toolbar-language"
            className="w-36"
            value={language}
            options={LANGUAGE_DEFINITIONS.filter((definition) =>
              languages.includes(definition.code),
            ).map((definition) => ({ value: definition.code, label: definition.nativeName }))}
            onChange={(event) => props.onLanguage(event.target.value as LanguageCode)}
          />
        )}
        <SegmentedControl
          data-testid="editor-toolbar-device"
          label={t("website.preview.device")}
          value={mobile ? PREVIEW_DEVICE_MOBILE : PREVIEW_DEVICE_DESKTOP}
          options={[
            { value: PREVIEW_DEVICE_DESKTOP, label: t("website.preview.desktop") },
            { value: PREVIEW_DEVICE_MOBILE, label: t("website.preview.mobile") },
          ]}
          onChange={(device) => props.onMobile(device === PREVIEW_DEVICE_MOBILE)}
        />
        <Button
          variant="secondary"
          icon={<Icon name="gear" />}
          data-testid="editor-toolbar-settings"
          onClick={props.onSettings}
        >
          {t("website.editor.siteSettings")}
        </Button>
      </div>

      <div data-part="status" className="ms-auto flex shrink-0 items-center gap-2">
        <Badge tone={publishedAt ? "success" : "neutral"} data-testid="editor-toolbar-state">
          {t(publishedAt ? "website.status.live" : "website.status.draft")}
        </Badge>
        {props.dirty && (
          <Badge tone="info" data-testid="editor-toolbar-dirty">
            {t("website.editor.unsaved")}
          </Badge>
        )}
        {props.unpublished && publishedAt && (
          <Badge tone="warning" data-testid="editor-toolbar-unpublished">
            {t("website.status.unpublished")}
          </Badge>
        )}
        {publishedAt && (
          <span data-part="published-at" className="text-label text-ink-muted max-2xl:hidden">
            {t("website.status.publishedAt", { at: formatDateTime(publishedAt) })}
          </span>
        )}
        {props.invalid && (
          <Button
            variant="quiet"
            size="sm"
            icon={<Icon name="alert" />}
            data-testid="editor-toolbar-invalid"
            onClick={props.onShowProblem}
          >
            {t("website.editor.invalid")}
          </Button>
        )}
        {publishedAt && <OpenSiteLink data-testid="editor-toolbar-open" href={props.liveHref} />}
        <Button
          variant="secondary"
          data-testid="editor-toolbar-save"
          isLoading={props.saving}
          aria-disabled={!props.dirty || props.invalid}
          onClick={() => !props.invalid && props.dirty && props.onSave()}
        >
          {t("website.editor.saveDraft")}
        </Button>
        <Button
          icon={<Icon name="send" />}
          data-testid="editor-toolbar-publish"
          isLoading={props.publishing}
          aria-disabled={!props.unpublished || props.invalid}
          onClick={() => !props.invalid && props.unpublished && props.onPublish()}
        >
          {t("website.publish")}
        </Button>
        <Button
          variant="quiet"
          icon={<Icon name="x" />}
          data-testid="editor-toolbar-exit"
          onClick={props.onExit}
        >
          {t("website.editor.exit")}
        </Button>
      </div>
    </section>
  );
}
