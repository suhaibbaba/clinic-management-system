import { siteDocumentSchema, type SiteDocument } from "@clinic/shared";
import { useEffect, useMemo, useRef, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@clinic/ui";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { EditorContext } from "@web/modules/website/lib/editor-context";

export function DraftModal({
  "data-testid": testId,
  title,
  titleValues,
  description,
  document,
  update,
  images,
  remember,
  inScope,
  reveal,
  onCancel,
  onDone,
  children,
}: {
  readonly "data-testid": string;
  readonly title: string;
  readonly titleValues?: Record<string, string>;
  readonly description?: string;
  readonly document: SiteDocument;
  readonly update: (change: (current: SiteDocument) => SiteDocument) => void;
  readonly images: Readonly<Record<string, string>>;
  readonly remember: (key: string, url: string) => void;
  readonly inScope: (key: string) => boolean;
  readonly reveal: boolean;
  readonly onCancel: () => void;
  readonly onDone: () => void;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  const scoped = useRef(inScope);

  scoped.current = inScope;

  const allErrors = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(schemaErrors(siteDocumentSchema, document)).filter(([key]) =>
          scoped.current(key),
        ),
      ),
    [document],
  );
  const form = useFormErrors(allErrors);
  const revealed = useRef(false);

  useEffect(() => {
    if (reveal && !revealed.current) {
      revealed.current = true;
      form.check();
    }
  }, [reveal, form]);

  const context = useMemo(
    () => ({
      draft: document,
      update,
      images,
      remember,
      errors: form.errors,
      leave: form.leave,
      scope: "",
    }),
    [document, update, images, remember, form.errors, form.leave],
  );

  return (
    <Modal
      data-testid={testId}
      open
      onOpenChange={(open) => !open && onCancel()}
      title={title}
      {...(titleValues !== undefined && { titleValues })}
      {...(description !== undefined && { description })}
      size="wide"
      footer={
        <>
          <Button variant="secondary" data-testid={`${testId}-cancel`} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            data-testid={`${testId}-done`}
            aria-disabled={!form.isValid}
            onClick={() => form.isValid && onDone()}
          >
            {t("common.done")}
          </Button>
        </>
      }
    >
      <EditorContext.Provider value={context}>
        <div ref={form.formRef} data-part="form" className="flex flex-col gap-5">
          {children}
        </div>
      </EditorContext.Provider>
    </Modal>
  );
}
