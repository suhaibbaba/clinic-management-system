import {
  insertBlock,
  newBlock,
  setPageEnabled,
  SITE_PAGE_KIND,
  SITE_PREVIEW_MESSAGE,
  siteDocumentPage,
  siteDocumentSchema,
  type SiteBlockType,
  type SiteDocument,
  type SiteEditorMessage,
  type WebsiteEditor as WebsiteEditorData,
} from "@clinic/shared";
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useConfirm, useToast } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { WEBSITE_PAGE_PATH } from "@web/shared/constants/layout";
import { useLeaveGuard } from "@web/shared/hooks/use-leave-guard";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { BlockForm } from "@web/modules/website/components/block-form";
import { BlockLibrary } from "@web/modules/website/components/block-library";
import { DraftModal } from "@web/modules/website/components/draft-modal";
import { EditorScope } from "@web/modules/website/components/editor-scope";
import { EditorToolbar } from "@web/modules/website/components/editor-toolbar";
import { SitePreview } from "@web/modules/website/components/site-preview";
import { SiteSettings } from "@web/modules/website/components/site-settings";
import {
  EDITOR_EDIT_PARAM,
  EDITOR_LANGUAGE_PARAM,
  EDITOR_PAGE_PARAM,
  EDITOR_SETTINGS_OPEN,
  EDITOR_SETTINGS_PARAM,
  PREVIEW_DEVICE_DESKTOP,
  PREVIEW_DEVICE_MOBILE,
  PREVIEW_DEVICE_PARAM,
  SITE_PAGE_PATHS,
} from "@web/modules/website/constants";
import {
  applyBlockMessage,
  blockErrorScopes,
  blockPath,
  editorPageKind,
  editParam,
  findBlock,
  firstInvalidBlock,
  inErrorScope,
  isBlockError,
  previewPath,
  readEditParam,
  type BlockTarget,
} from "@web/modules/website/lib/editor-page";
import { usePublishSite, useSaveSiteDraft } from "@web/modules/website/queries";

const SETTINGS_KEY = "settings";

interface WorkingCopy {
  readonly key: string;
  readonly document: SiteDocument;
}

export function WebsiteEditor({ editor }: { readonly editor: WebsiteEditorData }): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const { confirm, dialog } = useConfirm("website-editor-confirm");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const saveDraft = useSaveSiteDraft();
  const publish = usePublishSite();

  const saved = editor.site.document;
  const [draft, setDraft] = useState<SiteDocument>(saved);
  const [working, setWorking] = useState<WorkingCopy | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, string>>({});
  const [inserting, setInserting] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => setDraft(saved), [saved]);

  useEffect(() => {
    if (!leaving) {
      return;
    }

    window.close();
    void navigate(WEBSITE_PAGE_PATH, { replace: true });
  }, [leaving, navigate]);

  const { locale, bookingEnabled, slug } = editor.site.clinic;
  const kind = editorPageKind(params.get(EDITOR_PAGE_PARAM));
  const settingsOpen = params.get(EDITOR_SETTINGS_PARAM) === EDITOR_SETTINGS_OPEN;
  const target = readEditParam(params.get(EDITOR_EDIT_PARAM));
  const editedBlock = target ? findBlock(draft, target.kind, target.id) : undefined;
  const editedPath = target && editedBlock ? blockPath(draft, target.kind, target.id) : null;
  const openKey = settingsOpen
    ? SETTINGS_KEY
    : target && editedBlock && editedPath
      ? editParam(target)
      : null;
  const shown = openKey !== null && working?.key === openKey ? working.document : draft;
  const language =
    locale.languages.find((code) => code === params.get(EDITOR_LANGUAGE_PARAM)) ??
    locale.primaryLanguage;
  const mobile = params.get(PREVIEW_DEVICE_PARAM) === PREVIEW_DEVICE_MOBILE;

  const images = useMemo(
    () => ({ ...editor.site.images, ...uploaded }),
    [editor.site.images, uploaded],
  );
  const site = useMemo(
    () => ({ ...editor.site, document: shown, images }),
    [editor.site, shown, images],
  );
  const editingId = settingsOpen ? null : (editedBlock?.id ?? null);
  const edit = useMemo(() => ({ editing: editingId }), [editingId]);

  const allErrors = useMemo(() => schemaErrors(siteDocumentSchema, draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const unpublished = dirty || editor.unpublished;
  const invalid = Object.keys(allErrors).length > 0;
  const leaveGuard = useLeaveGuard(dirty && !leaving, "website-editor-leave");

  const remember = useCallback(
    (key: string, url: string) => setUploaded((current) => ({ ...current, [key]: url })),
    [],
  );
  const updateWorking = useCallback(
    (change: (current: SiteDocument) => SiteDocument) =>
      setWorking((current) =>
        openKey === null
          ? null
          : {
              key: openKey,
              document: change(current?.key === openKey ? current.document : draft),
            },
      ),
    [openKey, draft],
  );

  const setParam = (changes: Record<string, string | null>): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        for (const [key, value] of Object.entries(changes)) {
          if (value === null) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }

        return next;
      },
      { replace: true },
    );

  const pageParam = (next: BlockTarget["kind"]): string | null =>
    next === SITE_PAGE_KIND.HOME ? null : next;

  const openBlock = (next: BlockTarget, revealErrors = false): void => {
    setWorking(null);
    setReveal(revealErrors);
    setParam({
      [EDITOR_PAGE_PARAM]: pageParam(next.kind),
      [EDITOR_EDIT_PARAM]: editParam(next),
      [EDITOR_SETTINGS_PARAM]: null,
    });
  };

  const openSettings = (revealErrors = false): void => {
    setWorking(null);
    setReveal(revealErrors);
    setParam({ [EDITOR_SETTINGS_PARAM]: EDITOR_SETTINGS_OPEN, [EDITOR_EDIT_PARAM]: null });
  };

  const close = (): void => {
    setWorking(null);
    setReveal(false);
    setParam({ [EDITOR_EDIT_PARAM]: null, [EDITOR_SETTINGS_PARAM]: null });
  };

  const apply = (): void => {
    setDraft(shown);
    close();
  };

  const showProblem = (): void => {
    const problem = firstInvalidBlock(draft, Object.keys(allErrors));

    if (problem) {
      openBlock(problem, true);
    } else {
      openSettings(true);
    }
  };

  const pick = (type: SiteBlockType): void => {
    if (inserting === null) {
      return;
    }

    const existing = siteDocumentPage(draft, kind)?.blocks.map((block) => block.id) ?? [];
    const block = newBlock(type, existing);

    setDraft((current) => insertBlock(current, kind, inserting, block));
    setInserting(null);
    openBlock({ kind, id: block.id });
  };

  const onEditorMessage = (message: SiteEditorMessage): void => {
    switch (message.type) {
      case SITE_PREVIEW_MESSAGE.EDIT:
        openBlock({ kind: message.kind, id: message.id });
        return;
      case SITE_PREVIEW_MESSAGE.INSERT:
        if (message.kind === kind) {
          setInserting(message.index);
        }
        return;
      case SITE_PREVIEW_MESSAGE.REMOVE: {
        const block = findBlock(draft, message.kind, message.id);

        if (!block) {
          return;
        }

        confirm({
          title: "website.editor.removeConfirm.title",
          titleValues: { name: t(`website.editor.blocks.${block.type}.name`) },
          consequences: [t("website.editor.removeConfirm.consequence")],
          confirmLabel: "website.editor.remove",
          tone: "danger",
          onConfirm: async () => {
            setDraft((current) => applyBlockMessage(current, message));
          },
        });
        return;
      }
      default:
        setDraft((current) => applyBlockMessage(current, message));
    }
  };

  const save = async (): Promise<void> => {
    if (invalid) {
      showProblem();
      return;
    }

    try {
      await saveDraft.mutateAsync(draft);
      toast.success("website.saved");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const goLive = (): void => {
    if (invalid) {
      showProblem();
      return;
    }

    confirm({
      title: "website.editor.publishConfirm.title",
      consequences: [t("website.editor.publishConfirm.consequence")],
      confirmLabel: "website.publish",
      tone: "primary",
      onConfirm: async () => {
        try {
          await publish.mutateAsync(draft);
          toast.success("website.published");
        } catch (error) {
          toast.error(...errorToast(error));
        }
      },
    });
  };

  const exit = (): void => {
    if (!dirty) {
      setLeaving(true);
      return;
    }

    confirm({
      title: "common.leaveUnsavedTitle",
      consequences: [t("common.leaveUnsavedBody")],
      confirmLabel: "common.leave",
      tone: "primary",
      onConfirm: async () => setLeaving(true),
    });
  };

  return (
    <div data-testid="website-editor" className="flex min-h-0 flex-1 flex-col">
      <EditorToolbar
        pages={draft.pages}
        kind={kind}
        onKind={(next) =>
          setParam({
            [EDITOR_PAGE_PARAM]: pageParam(next),
            [EDITOR_EDIT_PARAM]: null,
          })
        }
        onPageEnabled={(enabled) => setDraft((current) => setPageEnabled(current, kind, enabled))}
        bookingAvailable={bookingEnabled}
        language={language}
        languages={locale.languages}
        onLanguage={(next) =>
          setParam({ [EDITOR_LANGUAGE_PARAM]: next === locale.primaryLanguage ? null : next })
        }
        mobile={mobile}
        onMobile={(next) =>
          setParam({ [PREVIEW_DEVICE_PARAM]: next ? PREVIEW_DEVICE_MOBILE : null })
        }
        onSettings={() => openSettings()}
        publishedAt={editor.publishedAt}
        liveHref={`/site/${slug}${SITE_PAGE_PATHS[kind]}`}
        dirty={dirty}
        unpublished={unpublished}
        invalid={invalid}
        onShowProblem={showProblem}
        saving={saveDraft.isPending}
        publishing={publish.isPending}
        onSave={() => void save()}
        onPublish={goLive}
        onExit={exit}
      />

      <div
        data-testid="website-editor-canvas"
        data-device={mobile ? PREVIEW_DEVICE_MOBILE : PREVIEW_DEVICE_DESKTOP}
        className={cn("min-h-0 min-w-0 flex-1", mobile && "bg-inset px-4 py-6")}
      >
        <SitePreview
          site={site}
          edit={edit}
          mobile={mobile}
          path={previewPath(kind, language, locale.primaryLanguage)}
          onEditorMessage={onEditorMessage}
        />
      </div>

      {!settingsOpen && openKey !== null && editedBlock && editedPath && (
        <DraftModal
          key={openKey}
          data-testid="block-edit-modal"
          title={`website.editor.blocks.${editedBlock.type}.name`}
          description={`website.editor.blocks.${editedBlock.type}.description`}
          document={shown}
          update={updateWorking}
          images={images}
          remember={remember}
          inScope={(key) => inErrorScope(key, blockErrorScopes(editedBlock, editedPath))}
          reveal={reveal}
          onCancel={close}
          onDone={apply}
        >
          <EditorScope path={editedPath} root>
            <BlockForm block={editedBlock} doctors={editor.site.doctors} />
          </EditorScope>
        </DraftModal>
      )}

      {settingsOpen && (
        <DraftModal
          key={SETTINGS_KEY}
          data-testid="site-settings-modal"
          title="website.editor.siteSettings"
          document={shown}
          update={updateWorking}
          images={images}
          remember={remember}
          inScope={(key) => !isBlockError(key)}
          reveal={reveal}
          onCancel={close}
          onDone={apply}
        >
          <SiteSettings doctors={editor.site.doctors} bookingAvailable={bookingEnabled} />
        </DraftModal>
      )}

      <BlockLibrary
        kind={kind}
        open={inserting !== null}
        onOpenChange={(open) => !open && setInserting(null)}
        onPick={pick}
      />
      {dialog}

      {leaveGuard}
    </div>
  );
}
