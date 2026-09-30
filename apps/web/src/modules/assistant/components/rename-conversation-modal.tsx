import {
  AI_TITLE_MAX_LENGTH,
  renameAiConversationSchema,
  type AiConversation,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Input, Modal, useToast } from "@clinic/ui";
import { useRenameConversation } from "@web/modules/assistant/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";

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
  const body = { title: title.trim() };
  const form = useFormErrors(schemaErrors(renameAiConversationSchema, body));
  const { reset } = form;

  useEffect(() => {
    if (conversation) {
      setTitle(conversation.title);
      reset();
    }
  }, [conversation, reset]);

  const submit = async (): Promise<void> => {
    if (!form.check() || !conversation) {
      return;
    }

    try {
      await rename.mutateAsync({ id: conversation.id, ...body });
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
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
          <Button
            {...(!form.isValid && { "aria-disabled": true })}
            onClick={() => void submit()}
            isLoading={rename.isPending}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} onBlur={form.leave("title")}>
        <FormField
          htmlFor="assistant-title"
          label={t("assistant.title")}
          error={form.errors["title"]}
        >
          <Input
            id="assistant-title"
            value={title}
            maxLength={AI_TITLE_MAX_LENGTH}
            onChange={(event) => setTitle(event.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
