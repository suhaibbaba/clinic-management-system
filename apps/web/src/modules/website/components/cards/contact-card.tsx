import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@clinic/ui";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { TopicsField } from "@web/modules/website/components/topics-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";

export function ContactCard(): JSX.Element {
  const { t } = useTranslation();
  const { draft, update } = useEditor();

  return (
    <EditorCard id="contact" title="website.cards.contact" hint="website.cards.contactHint">
      <DraftText path="contact.title" label="website.fields.title" />
      <DraftText path="contact.subtitle" label="website.fields.subtitle" />
      <DraftText path="contact.intro" label="website.fields.intro" multiline />
      <DraftImage
        path="contact.image"
        label="website.fields.headerImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.HERO}
      />
      <DraftText path="contact.note" label="website.fields.note" />
      <Switch
        data-testid="website-contact-form-switch"
        checked={draft.contact.formEnabled}
        label={t("website.fields.formEnabled")}
        onCheckedChange={(formEnabled) =>
          update((current) => ({ ...current, contact: { ...current.contact, formEnabled } }))
        }
      />
      {draft.contact.formEnabled && <TopicsField />}
      <DraftText path="contact.welcome" label="website.fields.welcome" />
      <DraftText path="contact.welcomeBody" label="website.fields.welcomeBody" />
      <DraftImage
        path="contact.welcomeImage"
        label="website.fields.welcomeImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.CARD}
      />
    </EditorCard>
  );
}
