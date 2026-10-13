import { SITE_TOPICS_MAX } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon } from "@clinic/ui";
import { DraftText } from "@web/modules/website/components/draft-text";
import { RowTools } from "@web/modules/website/components/row-tools";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { blankText, moveItem, removeAt } from "@web/modules/website/lib/site-draft";

export function TopicsField(): JSX.Element {
  const { t } = useTranslation();
  const { draft, update } = useEditor();
  const topics = draft.contact.topics;
  const write = (next: typeof topics): void =>
    update((current) => ({ ...current, contact: { ...current.contact, topics: next } }));

  return (
    <div data-testid="topics-field" className="flex flex-col gap-3">
      <p className="text-value font-medium text-ink">{t("website.fields.topics")}</p>
      <p className="-mt-2 text-label text-ink-muted">{t("website.fields.topicsHint")}</p>
      {topics.map((_, index) => (
        <div
          key={index}
          className="flex items-start gap-2 rounded-panel border border-line bg-sunken p-3"
        >
          <div className="min-w-0 flex-1">
            <DraftText
              path={`contact.topics.${index}`}
              label={t("website.fields.topic", { number: index + 1 })}
              required
            />
          </div>
          <RowTools
            id={`topics-field-${index}`}
            index={index}
            count={topics.length}
            onMove={(delta) => write(moveItem(topics, index, delta))}
            onRemove={() => write(removeAt(topics, index))}
          />
        </div>
      ))}
      {topics.length < SITE_TOPICS_MAX && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          icon={<Icon name="plus" />}
          data-testid="topics-field-add"
          onClick={() => write([...topics, blankText()])}
        >
          {t("website.fields.addTopic")}
        </Button>
      )}
    </div>
  );
}
