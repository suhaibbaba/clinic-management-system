import {
  isRtlLanguage,
  updateSpecialtySchema,
  type LocalizedText,
  type Specialty,
} from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Input, useToast } from "@clinic/ui";
import { useClinicLanguages } from "@web/shared/hooks/use-clinic-languages";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useUpdateSpecialty } from "@web/shared/queries/specialties";

export function SpecialtyNameForm({
  specialty,
  onDone,
  "data-testid": testId = "specialty-name-form",
}: {
  readonly "data-testid"?: string | undefined;
  readonly specialty: Specialty;
  readonly onDone: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const languages = useClinicLanguages();
  const update = useUpdateSpecialty();
  const [name, setName] = useState<LocalizedText>(specialty.name);

  const body = {
    name: Object.fromEntries(
      languages.map((code) => [code, (name[code] ?? "").trim()]),
    ) as LocalizedText,
  };
  const form = useFormErrors(schemaErrors(updateSpecialtySchema, body));

  const submit = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      await update.mutateAsync({ id: specialty.id, body });
      toast.success("specialties.renamed");
      onDone();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <div ref={form.formRef} data-testid={testId} className="flex flex-col gap-3">
      <div className={languages.length === 1 ? "max-w-(--field-max)" : "grid gap-3 sm:grid-cols-2"}>
        {languages.map((code) => (
          <div key={code} onBlur={form.leave(`name.${code}`)}>
            <FormField
              error={form.errors[`name.${code}`] ?? form.errors["name"]}
              label="specialties.nameIn"
              labelValues={{ language: t(`languages.in.${code}`) }}
              htmlFor={`specialty-name-${specialty.id}-${code}`}
              required={code === languages[0]}
            >
              <Input
                id={`specialty-name-${specialty.id}-${code}`}
                data-testid={`${testId}-name-${code}`}
                lang={code}
                dir={isRtlLanguage(code) ? "auto" : "ltr"}
                maxLength={80}
                value={name[code] ?? ""}
                onChange={(event) => setName({ ...name, [code]: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
            </FormField>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" data-testid={`${testId}-cancel`} onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button
          size="sm"
          data-testid={`${testId}-save`}
          aria-disabled={!form.isValid || update.isPending || undefined}
          isLoading={update.isPending}
          onClick={() => void submit()}
        >
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
