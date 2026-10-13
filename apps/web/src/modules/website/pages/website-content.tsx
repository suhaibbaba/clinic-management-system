import { siteContentSchema, type SiteContent, type WebsiteEditor } from "@clinic/shared";
import { useEffect, useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Badge, Button, Icon, SegmentedControl, Select, useToast } from "@clinic/ui";
import { UnsavedChanges } from "@web/shared/components/unsaved-changes";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDateTime } from "@web/shared/lib/format";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { AboutCard } from "@web/modules/website/components/cards/about-card";
import { BookingCard } from "@web/modules/website/components/cards/booking-card";
import { BrandCard } from "@web/modules/website/components/cards/brand-card";
import { ContactCard } from "@web/modules/website/components/cards/contact-card";
import { DoctorsCard } from "@web/modules/website/components/cards/doctors-card";
import { GalleryCard } from "@web/modules/website/components/cards/gallery-card";
import { HeroCard } from "@web/modules/website/components/cards/hero-card";
import { ServicesCard } from "@web/modules/website/components/cards/services-card";
import { StoryCard } from "@web/modules/website/components/cards/story-card";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { SectionsField } from "@web/modules/website/components/sections-field";
import { SitePreview } from "@web/modules/website/components/site-preview";
import {
  PREVIEW_DEVICE_DESKTOP,
  PREVIEW_DEVICE_MOBILE,
  PREVIEW_DEVICE_PARAM,
  PREVIEW_PAGE_PARAM,
  PREVIEW_PAGES,
} from "@web/modules/website/constants";
import { EditorContext } from "@web/modules/website/lib/editor-context";
import { usePublishSite, useSaveSiteDraft } from "@web/modules/website/queries";

export function WebsiteContent({ editor }: { readonly editor: WebsiteEditor }): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const saveDraft = useSaveSiteDraft();
  const publish = usePublishSite();

  const [draft, setDraft] = useState<SiteContent>(editor.site.content);
  const [uploaded, setUploaded] = useState<Record<string, string>>({});

  useEffect(() => setDraft(editor.site.content), [editor.site.content]);

  const images = useMemo(
    () => ({ ...editor.site.images, ...uploaded }),
    [editor.site.images, uploaded],
  );
  const site = useMemo(
    () => ({ ...editor.site, content: draft, images }),
    [editor.site, draft, images],
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(editor.site.content);
  const mobile = params.get(PREVIEW_DEVICE_PARAM) === PREVIEW_DEVICE_MOBILE;
  const previewPage =
    PREVIEW_PAGES.find((page) => page.value === params.get(PREVIEW_PAGE_PARAM)) ?? PREVIEW_PAGES[0];

  const form = useFormErrors(schemaErrors(siteContentSchema, draft));

  const context = useMemo(
    () => ({
      draft,
      update: (change: (current: SiteContent) => SiteContent) => setDraft(change),
      images,
      remember: (key: string, url: string) =>
        setUploaded((current) => ({ ...current, [key]: url })),
      errors: form.errors,
      leave: form.leave,
    }),
    [draft, images, form.errors, form.leave],
  );

  const setParam = (key: string, value: string | null): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (value === null) {
          next.delete(key);
        } else {
          next.set(key, value);
        }

        return next;
      },
      { replace: true },
    );

  const save = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      await saveDraft.mutateAsync(draft);
      toast.success("website.saved");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const goLive = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      await publish.mutateAsync(draft);
      toast.success("website.published");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const unpublished = dirty || editor.unpublished;

  return (
    <EditorContext.Provider value={context}>
      <div
        ref={form.formRef}
        data-testid="website-content"
        className="grid gap-6 lg:grid-cols-[minmax(0,var(--form-max))_minmax(0,1fr)]"
      >
        <div className="flex min-w-0 flex-col gap-5">
          <section
            data-testid="website-status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
          >
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2">
                <Badge
                  tone={editor.publishedAt ? "success" : "neutral"}
                  data-testid="website-state"
                >
                  {t(editor.publishedAt ? "website.status.live" : "website.status.draft")}
                </Badge>
                {unpublished && editor.publishedAt && (
                  <Badge tone="warning" data-testid="website-unpublished">
                    {t("website.status.unpublished")}
                  </Badge>
                )}
              </span>
              {editor.publishedAt && (
                <span data-testid="website-published-at" className="text-label text-ink-muted">
                  {t("website.status.publishedAt", { at: formatDateTime(editor.publishedAt) })}
                </span>
              )}
            </div>

            <span className="flex flex-wrap items-center gap-2">
              {editor.publishedAt && (
                <a
                  href={`/site/${editor.site.clinic.slug}${previewPage.path}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-testid="website-open"
                  className="pill-text inline-flex h-(--control-h) items-center gap-2 rounded-control border border-line bg-surface px-3.5 text-label font-medium text-ink hover:border-primary-600 hover:text-primary-700"
                >
                  <Icon name="globe" />
                  {t("website.open")}
                </a>
              )}
              <Button
                icon={<Icon name="send" />}
                data-testid="website-publish"
                isLoading={publish.isPending}
                disabled={!unpublished}
                onClick={() => void goLive()}
              >
                {t("website.publish")}
              </Button>
            </span>
          </section>

          <EditorCard
            id="sections"
            title="website.cards.sections"
            hint="website.cards.sectionsHint"
          >
            <SectionsField
              visible={draft.sections}
              onChange={(sections) => setDraft((current) => ({ ...current, sections }))}
            />
          </EditorCard>
          <BrandCard />
          <HeroCard />
          <StoryCard />
          <ServicesCard />
          <DoctorsCard doctors={editor.site.doctors} />
          <AboutCard />
          <GalleryCard />
          <BookingCard />
          <ContactCard />
        </div>

        <div className="hidden min-w-0 lg:block">
          <div className="sticky top-4 flex h-[calc(100dvh-7rem)] flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Select
                aria-label={t("website.preview.page")}
                data-testid="website-preview-page"
                className="w-48"
                value={previewPage.value}
                options={PREVIEW_PAGES.map((page) => ({ value: page.value, label: t(page.label) }))}
                onChange={(event) =>
                  setParam(
                    PREVIEW_PAGE_PARAM,
                    event.target.value === PREVIEW_PAGES[0].value ? null : event.target.value,
                  )
                }
              />
              <SegmentedControl
                data-testid="website-preview-device"
                label={t("website.preview.device")}
                value={mobile ? PREVIEW_DEVICE_MOBILE : PREVIEW_DEVICE_DESKTOP}
                options={[
                  { value: PREVIEW_DEVICE_DESKTOP, label: t("website.preview.desktop") },
                  { value: PREVIEW_DEVICE_MOBILE, label: t("website.preview.mobile") },
                ]}
                onChange={(device) =>
                  setParam(PREVIEW_DEVICE_PARAM, device === PREVIEW_DEVICE_DESKTOP ? null : device)
                }
              />
            </div>
            <div className="min-h-0 flex-1">
              <SitePreview site={site} mobile={mobile} path={previewPage.path} />
            </div>
          </div>
        </div>

        <UnsavedChanges
          data-testid="website-unsaved"
          dirty={dirty}
          saving={saveDraft.isPending}
          invalid={!form.isValid}
          onSave={() => void save()}
          onDiscard={() => {
            setDraft(editor.site.content);
            form.reset();
          }}
        />
      </div>
    </EditorContext.Provider>
  );
}
