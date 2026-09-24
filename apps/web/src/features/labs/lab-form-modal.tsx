import { createLabSchema, type Lab, type CreateLabInput } from "@clinic/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type JSX } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, FormField, Input, Modal, PhoneInput, Textarea, useToast } from "@clinic/ui";
import { useCreateLab, useUpdateLab } from "@web/features/labs/queries";
import { errorMessageKey } from "@web/lib/api-error";

export function LabFormModal({
  open,
  onOpenChange,
  lab,
  "data-testid": testId = "lab-form-modal",
}: {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly lab?: Lab | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const create = useCreateLab();
  const update = useUpdateLab();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateLabInput>({
    resolver: zodResolver(createLabSchema),
    defaultValues: { name: "", phone: null, address: "", contactPerson: "", notes: "" },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: lab?.name ?? "",
        phone: lab?.phone ?? null,
        address: lab?.address ?? "",
        contactPerson: lab?.contactPerson ?? "",
        notes: lab?.notes ?? "",
      });
    }
  }, [open, lab, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      if (lab) {
        await update.mutateAsync({ id: lab.id, body: values });
      } else {
        await create.mutateAsync(values);
      }

      toast.success(lab ? "labs.updated" : "labs.created");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={onOpenChange}
      title={t(lab ? "labs.editTitle" : "labs.addTitle")}
      footer={
        <>
          <Button
            variant="secondary"
            data-testid={`${testId}-cancel`}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={isSubmitting}
            data-testid={`${testId}-save`}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form
        data-testid={`${testId}-form`}
        className="flex flex-col gap-4"
        onSubmit={(event) => void submit(event)}
      >
        <FormField label="labs.fields.name" htmlFor="lab-name" error={errors.name}>
          <Input id="lab-name" data-testid="lab-field-name" {...register("name")} />
        </FormField>

        <FormField label="labs.fields.contactPerson" htmlFor="lab-contact" optional>
          <Input id="lab-contact" data-testid="lab-field-contact" {...register("contactPerson")} />
        </FormField>

        <FormField
          label="labs.fields.phone"
          htmlFor="lab-phone"
          error={errors.phone}
          errorKey={errors.phone ? "errors.validation.invalidPhone" : undefined}
          optional
        >
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                id="lab-phone"
                data-testid="lab-field-phone"
                hasError={Boolean(errors.phone)}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </FormField>

        <FormField label="labs.fields.address" htmlFor="lab-address" optional>
          <Input id="lab-address" data-testid="lab-field-address" {...register("address")} />
        </FormField>

        <FormField label="labs.fields.notes" htmlFor="lab-notes" optional>
          <Textarea id="lab-notes" data-testid="lab-field-notes" rows={2} {...register("notes")} />
        </FormField>
      </form>
    </Modal>
  );
}
