import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { MenuItem, MenuLabel } from "@clinic/ui";
import type { DocumentActions } from "@web/shared/hooks/use-document-actions";
import type { DocumentSource } from "@web/shared/lib/document-source";

export function DocumentMenuItems({
  actions,
  source,
  title,
  "data-testid": testId,
}: {
  readonly actions: DocumentActions;
  readonly source: DocumentSource;
  readonly title?: string | undefined;
  readonly "data-testid": string;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      {title !== undefined && <MenuLabel data-testid={`${testId}-title`}>{title}</MenuLabel>}
      <MenuItem icon="print" data-testid={`${testId}-print`} onSelect={() => actions.print(source)}>
        {t("documents.print")}
      </MenuItem>
      {source.send && (
        <MenuItem
          icon="whatsapp"
          data-testid={`${testId}-whatsapp`}
          unavailable={!actions.sendAvailable}
          onSelect={() => actions.send(source)}
          trailing={
            actions.sendAvailable ? undefined : (
              <span className="text-meta text-ink-subtle">{t("documents.whatsappOff")}</span>
            )
          }
        >
          {t("documents.whatsapp")}
        </MenuItem>
      )}
      <MenuItem
        icon="file"
        data-testid={`${testId}-download`}
        onSelect={() => actions.download(source)}
      >
        {t("documents.download")}
      </MenuItem>
    </>
  );
}
