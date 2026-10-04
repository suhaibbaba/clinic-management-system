import {
  CHART_TYPE,
  LOOKUP_LIST,
  createProcedureCatalogItemSchema,
  lookupLabel,
  type ProcedureCatalogItem,
} from "@clinic/shared";
import { useEffect, useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Input, Modal, MoneyInput, Select, useToast } from "@clinic/ui";
import { procedureOutcomes, wholePrice } from "@web/modules/patients/lib/price-list";
import { useCreateCatalogItem, useUpdateCatalogItem } from "@web/modules/patients/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupList } from "@web/shared/queries/lookups";
import { useSpecialties } from "@web/shared/queries/specialties";

export function ProcedurePriceModal({
  open,
  item,
  onClose,
  "data-testid": testId = "procedure-price-modal",
}: {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly item: ProcedureCatalogItem | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();

  const create = useCreateCatalogItem();
  const update = useUpdateCatalogItem();
  const specialties = useSpecialties();
  const toothStates = useLookupList(LOOKUP_LIST.TOOTH_STATE);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [outcome, setOutcome] = useState("");

  const choices = useMemo(
    () =>
      (specialties.data?.items ?? []).filter(
        (specialty) => specialty.isActive || specialty.id === item?.specialtyId,
      ),
    [specialties.data, item?.specialtyId],
  );
  const onlySpecialty = choices.length === 1 ? choices[0]?.id : undefined;
  const chosenSpecialty = specialtyId || onlySpecialty || "";
  const charted =
    choices.find((specialty) => specialty.id === chosenSpecialty)?.chartType ===
    CHART_TYPE.TOOTH_FDI;
  const outcomes = useMemo(() => procedureOutcomes(toothStates), [toothStates]);

  const body = {
    specialtyId: chosenSpecialty,
    code: code.trim(),
    name: name.trim(),
    defaultPrice: price,
    chartOutcome: charted && outcome !== "" ? outcome : null,
  };

  const form = useFormErrors(schemaErrors(createProcedureCatalogItemSchema, body));
  const { reset } = form;
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(item?.name ?? "");
    setCode(item?.code ?? "");
    setPrice(item ? wholePrice(item.defaultPrice) : "");
    setSpecialtyId(item?.specialtyId ?? "");
    setOutcome(item?.chartOutcome ?? "");
    reset();
  }, [open, item, reset]);

  const submit = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      if (item) {
        await update.mutateAsync({ id: item.id, body });
        toast.success("priceList.updated");
      } else {
        await create.mutateAsync({ ...body, isActive: true });
        toast.success("priceList.created");
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
      size="form"
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      onEnter={() => void submit()}
      title={t(item ? "priceList.editTitle" : "priceList.newTitle")}
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
        <div onBlur={form.leave("name")}>
          <FormField
            error={form.errors["name"]}
            label="priceList.name"
            htmlFor="price-name"
            required
          >
            <Input
              id="price-name"
              data-testid="price-field-name"
              dir="ltr"
              maxLength={160}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div onBlur={form.leave("code")}>
            <FormField
              error={form.errors["code"]}
              label="priceList.code"
              htmlFor="price-code"
              hint={t("priceList.codeHint")}
              required
            >
              <Input
                id="price-code"
                data-testid="price-field-code"
                dir="ltr"
                maxLength={32}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </FormField>
          </div>

          <div onBlur={form.leave("defaultPrice")}>
            <FormField
              error={form.errors["defaultPrice"]}
              label="priceList.price"
              htmlFor="price-amount"
              required
            >
              <MoneyInput
                id="price-amount"
                data-testid="price-field-amount"
                currency={currency}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </FormField>
          </div>
        </div>

        {choices.length > 1 && (
          <div onBlur={form.leave("specialtyId")}>
            <FormField
              error={form.errors["specialtyId"]}
              label="priceList.specialty"
              htmlFor="price-specialty"
              required
            >
              <Select
                id="price-specialty"
                data-testid="price-field-specialty"
                placeholder={t("priceList.pickSpecialty")}
                options={choices.map((specialty) => ({
                  value: specialty.id,
                  label: specialty.name,
                }))}
                value={specialtyId}
                onChange={(event) => setSpecialtyId(event.target.value)}
              />
            </FormField>
          </div>
        )}

        {charted && (
          <FormField
            label="priceList.outcome"
            htmlFor="price-outcome"
            hint={t("priceList.outcomeHint")}
          >
            <Select
              id="price-outcome"
              data-testid="price-field-outcome"
              className="max-w-(--field-max)"
              placeholder={t("priceList.noOutcome")}
              options={outcomes.map((state) => ({
                value: state.code,
                label: lookupLabel(state, i18n.language),
              }))}
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            />
          </FormField>
        )}
      </div>
    </Modal>
  );
}
