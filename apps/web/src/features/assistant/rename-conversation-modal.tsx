import { AI_TITLE_MAX_LENGTH, type AiConversation } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Input, Modal, useToast } from "@clinic/ui";
import { useRenameConversation } from "@web/features/assistant/queries";
import { errorMessageKey } from "@web/lib/api-error";

export function RenameConversationModal({
  conversation,
  onClose,
}: {
  readonly conversation: AiConversation | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const rename = useRenameConversation();
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (conversation) {
      setTitle(conversation.title);
    }
  }, [conversation]);

  const submit = async (): Promise<void> => {
    if (!conversation || title.trim().length === 0) {
      return;
    }

    try {
      await rename.mutateAsync({ id: conversation.id, title: title.trim() });
      onClose();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      data-testid="assistant-rename"
      open={conversation !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t("assistant.rename")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} isLoading={rename.isPending}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <FormField htmlFor="assistant-title" label={t("assistant.title")}>
        <Input
          id="assistant-title"
          value={title}
          maxLength={AI_TITLE_MAX_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
