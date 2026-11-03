import { type SITE_BLOCK_TYPE, type SiteBlockOf } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@clinic/ui";
import { DraftText } from "@web/modules/website/components/draft-text";
import { TopicsField } from "@web/modules/website/components/topics-field";
import { useScoped } from "@web/modules/website/hooks/use-scoped";
import { MODAL_FORM_GRID } from "@web/modules/website/constants";

export function ContactMainBlockForm(): JSX.Element {
  const { t } = useTranslation();
  const { value, set } = useScoped<SiteBlockOf<typeof SITE_BLOCK_TYPE.CONTACT_MAIN>>();

  return (
    <div data-testid="contact-main-block-form" className={MODAL_FORM_GRID}>
      <DraftText path="note" label="website.fields.note" />
      <Switch
        data-testid="contact-main-block-form-switch"
        checked={value.formEnabled}
        label={t("website.fields.formEnabled")}
        onCheckedChange={(formEnabled) => set("formEnabled", formEnabled)}
      />
      {value.formEnabled && <TopicsField />}
    </div>
  );
}
