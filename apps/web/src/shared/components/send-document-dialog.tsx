import { sendDocumentSchema } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Modal, PhoneInput, useToast } from "@clinic/ui";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";

export function SendDocumentDialog({
  open,
  recipient,
  send,
  onClose,
  "data-testid": testId = "send-document",
}: {
  readonly open: boolean;
  readonly recipient: string | null | undefined;
  readonly send: (to: string) => Promise<void>;
  readonly onClose: () => void;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const [to, setTo] = useState<string | null>(null);
  const [isPending, setPending] = useState(false);

  const form = useFormErrors(schemaErrors(sendDocumentSchema, { to: to ?? "" }));
  const { reset } = form;

  useEffect(() => {
    if (open) {
      setTo(recipient ?? null);
      reset();
    }
  }, [open, recipient, reset]);

  const submit = async (): Promise<void> => {
    if (!form.check() || isPending) {
      return;
    }

    setPending(true);

    try {
      await send(sendDocumentSchema.parse({ to }).to);
      toast.success("documents.sent");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      onEnter={() => void submit()}
      title="documents.sendTitle"
      description={recipient ? "documents.sendHint" : "documents.noRecipient"}
      footer={
        <>
          <Button variant="secondary" data-testid={`${testId}-cancel`} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            icon={<Icon name="whatsapp" />}
            data-testid={`${testId}-submit`}
            aria-disabled={!form.isValid || isPending || undefined}
            isLoading={isPending}
            onClick={() => void submit()}
          >
            {t("documents.send")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} data-testid={`${testId}-form`} className="max-w-(--field-max)">
        <div onBlur={form.leave("to")}>
          <FormField
            error={form.errors["to"]}
            label="documents.to"
            htmlFor={`${testId}-to`}
            required
          >
            <PhoneInput
              id={`${testId}-to`}
              data-testid={`${testId}-to`}
              hasError={Boolean(form.errors["to"])}
              value={to}
              onChange={setTo}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
