import {
  DEFAULT_LOOKUP_COLOUR,
  ENGLISH_ONLY_LOOKUP_LISTS,
  LOOKUP_LIST,
  createLookupOptionSchema,
  drugRegimenSchema,
  readDrugNote,
  readDrugRegimen,
  type LookupListKey,
  type LookupOption,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, FormField, Input, Ltr, Modal, Textarea, useToast } from "@clinic/ui";
import { useCreateLookupOption, useUpdateLookupOption } from "@web/shared/queries/lookups";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { InstructionSuggestions } from "@web/shared/components/instruction-suggestions";
import { RegimenRow } from "@web/shared/components/regimen-row";
import {
  EMPTY_REGIMEN_INPUT,
  toRegimen,
  toRegimenInput,
  withDrugNote,
  withRegimen,
  type RegimenInput,
} from "@web/shared/lib/regimen";

const frequentDrugSchema = createLookupOptionSchema.extend({ meta: drugRegimenSchema });

export function LookupOptionModal({
  open,
  listKey,
  coloured,
  option,
  onClose,
  "data-testid": testId = "lookup-option-modal",
}: {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly listKey: LookupListKey;
  readonly coloured: boolean;
  readonly option: LookupOption | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const create = useCreateLookupOption();
  const update = useUpdateLookupOption();

  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [color, setColor] = useState(DEFAULT_LOOKUP_COLOUR);
  const [regimen, setRegimen] = useState<RegimenInput>(EMPTY_REGIMEN_INPUT);
  const [note, setNote] = useState("");
  const englishOnly = ENGLISH_ONLY_LOOKUP_LISTS.includes(listKey);
  const isDrug = listKey === LOOKUP_LIST.FREQUENT_DRUG;
  const arabic = englishOnly ? nameEn : nameAr;
  const chosen = coloured && (color !== DEFAULT_LOOKUP_COLOUR || !option?.isSystem) ? color : null;
  const body = {
    nameAr: arabic.trim(),
    nameEn: nameEn.trim(),
    color: chosen,
    ...(isDrug && {
      meta: withDrugNote(withRegimen(option?.meta, toRegimen(regimen)), note),
    }),
  };

  const form = useFormErrors(
    schemaErrors(isDrug ? frequentDrugSchema : createLookupOptionSchema, { listKey, ...body }),
  );
  const { reset } = form;
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) {
      return;
    }

    setNameAr(option?.nameAr ?? "");
    setNameEn(option?.nameEn ?? "");
    setColor(option?.color ?? DEFAULT_LOOKUP_COLOUR);
    setRegimen(toRegimenInput(readDrugRegimen(option?.meta)));
    setNote(readDrugNote(option?.meta));
    reset();
  }, [open, option, reset]);

  const submit = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      if (option) {
        await update.mutateAsync({ id: option.id, body });
        toast.success("lookups.updated");
      } else {
        await create.mutateAsync({ listKey, ...body });
        toast.success("lookups.created");
      }

      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
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
      title={t(option ? "lookups.editTitle" : "lookups.newTitle")}
      footer={
        <>
          <Button variant="secondary" data-testid={`${testId}-cancel`} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            data-testid={`${testId}-save`}
            aria-disabled={!form.isValid || isPending || undefined}
            isLoading={isPending}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} data-testid={`${testId}-form`} className="flex flex-col gap-4">
        {option?.isSystem && (
          <p
            data-testid={`${testId}-system-hint`}
            className="flex items-center gap-2 rounded-control bg-sunken px-3 py-2 text-label text-ink-muted"
          >
            <Badge tone="neutral">{t("lookups.system")}</Badge>
            {t("lookups.systemHint")}
          </p>
        )}

        <div className={englishOnly ? "max-w-(--field-max)" : "grid gap-4 sm:grid-cols-2"}>
          {!englishOnly && (
            <div onBlur={form.leave("nameAr")}>
              <FormField
                error={form.errors["nameAr"]}
                label="lookups.nameAr"
                htmlFor="lookup-name-ar"
                required
              >
                <Input
                  id="lookup-name-ar"
                  data-testid="lookup-field-name-ar"
                  dir="auto"
                  value={nameAr}
                  onChange={(event) => setNameAr(event.target.value)}
                />
              </FormField>
            </div>
          )}

          <div onBlur={form.leave("nameEn")}>
            <FormField
              error={form.errors["nameEn"]}
              label="lookups.nameEn"
              htmlFor="lookup-name-en"
              required
            >
              <Input
                id="lookup-name-en"
                data-testid="lookup-field-name-en"
                dir="ltr"
                value={nameEn}
                onChange={(event) => setNameEn(event.target.value)}
              />
            </FormField>
          </div>
        </div>

        {isDrug && (
          <fieldset data-testid={`${testId}-regimen`} className="flex flex-col gap-2">
            <legend className="text-label font-medium text-ink">
              {t("lookups.regimen.title")}
            </legend>
            <p className="text-meta text-ink-muted">{t("lookups.regimen.hint")}</p>
            <div
              onBlur={(event) => {
                form.leave("meta.perDose")(event);
                form.leave("meta.timesPerDay")(event);
                form.leave("meta.days")(event);
              }}
            >
              <RegimenRow
                data-testid="lookup-field-regimen"
                perDose={{
                  id: "lookup-per-dose",
                  "data-testid": "lookup-field-per-dose",
                  value: regimen.perDose,
                  onChange: (event) => setRegimen({ ...regimen, perDose: event.target.value }),
                }}
                timesPerDay={{
                  "data-testid": "lookup-field-times-per-day",
                  value: regimen.timesPerDay,
                  onChange: (event) => setRegimen({ ...regimen, timesPerDay: event.target.value }),
                }}
                days={{
                  "data-testid": "lookup-field-days",
                  value: regimen.days,
                  onChange: (event) => setRegimen({ ...regimen, days: event.target.value }),
                }}
              />
              {(form.errors["meta.perDose"] ??
                form.errors["meta.timesPerDay"] ??
                form.errors["meta.days"]) && (
                <p
                  data-testid="lookup-field-regimen-error"
                  className="mt-1 text-meta text-danger-600"
                >
                  {t("errors.validation.invalid")}
                </p>
              )}
            </div>
          </fieldset>
        )}

        {isDrug && (
          <div className="flex max-w-(--field-max) flex-col gap-2">
            <FormField
              label="lookups.drugNote"
              htmlFor="lookup-drug-note"
              hint={t("lookups.drugNoteHint")}
              optional
            >
              <Textarea
                rows={2}
                id="lookup-drug-note"
                data-testid="lookup-field-drug-note"
                value={note}
                maxLength={300}
                placeholder={t("prescriptions.instructionsPlaceholder")}
                onChange={(event) => setNote(event.target.value)}
              />
            </FormField>
            <InstructionSuggestions
              data-testid="lookup-drug-note-suggestions"
              value={note}
              onChange={setNote}
            />
          </div>
        )}

        {coloured && (
          <div onBlur={form.leave("color")}>
            <FormField
              error={form.errors["color"]}
              label="lookups.color"
              htmlFor="lookup-color"
              hint={t("lookups.colorHint")}
            >
              <span className="flex items-center gap-3">
                <input
                  id="lookup-color"
                  data-testid="lookup-field-color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="size-(--control-h) cursor-pointer rounded-control border border-line bg-surface p-1 lg:size-(--control-h-sm)"
                />
                <Ltr className="font-mono text-label text-ink-muted">{color}</Ltr>
              </span>
            </FormField>
          </div>
        )}

        {option && (
          <FormField label="lookups.code" htmlFor="lookup-code" hint={t("lookups.codeHint")}>
            <Input
              id="lookup-code"
              data-testid="lookup-field-code"
              dir="ltr"
              value={option.code}
              disabled
              readOnly
            />
          </FormField>
        )}
      </div>
    </Modal>
  );
}
