import {
  CHART_TYPE,
  CHART_TYPES,
  createSpecialtySchema,
  type ChartType,
  type Specialty,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Input, Ltr, Modal, Select, Switch, useToast } from "@clinic/ui";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import {
  useCreateSpecialty,
  useSpecialties,
  useUpdateSpecialty,
} from "@web/shared/queries/specialties";

export function SpecialtiesModal({
  open,
  mayCreate,
  mayUpdate,
  onClose,
}: {
  readonly open: boolean;
  readonly mayCreate: boolean;
  readonly mayUpdate: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const specialties = useSpecialties();
  const create = useCreateSpecialty();
  const update = useUpdateSpecialty();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [chartType, setChartType] = useState<ChartType>(CHART_TYPE.NONE);

  const body = { name: name.trim(), code: code.trim(), chartType, isActive: true };
  const form = useFormErrors(schemaErrors(createSpecialtySchema, body));
  const { reset } = form;

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setChartType(CHART_TYPE.NONE);
      reset();
    }
  }, [open, reset]);

  const fail = (error: unknown): void => toast.error(...errorToast(error));

  const add = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      await create.mutateAsync(body);
      toast.success("specialties.created");
      setName("");
      setCode("");
      setChartType(CHART_TYPE.NONE);
      reset();
    } catch (error) {
      fail(error);
    }
  };

  const toggle = async (specialty: Specialty): Promise<void> => {
    try {
      await update.mutateAsync({ id: specialty.id, body: { isActive: !specialty.isActive } });
    } catch (error) {
      fail(error);
    }
  };

  return (
    <Modal
      data-testid="specialties-modal"
      open={open}
      size="form"
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      title={t("specialties.title")}
      footer={
        <Button variant="secondary" data-testid="specialties-modal-close" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <ul data-testid="specialties-list" className="flex flex-col divide-y divide-line">
          {(specialties.data?.items ?? []).map((specialty) => (
            <li
              key={specialty.id}
              data-testid={`specialty-${specialty.id}`}
              className="flex items-center gap-3 py-2"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-value font-medium text-ink">{specialty.name}</span>
                <span className="text-label text-ink-subtle">
                  <Ltr>{specialty.code}</Ltr> · {t(`specialties.charts.${specialty.chartType}`)}
                </span>
              </span>

              <Switch
                data-testid="specialty-active"
                checked={specialty.isActive}
                aria-disabled={!mayUpdate || undefined}
                label={t(specialty.isActive ? "specialties.deactivate" : "specialties.activate")}
                hideLabel
                onCheckedChange={() => mayUpdate && void toggle(specialty)}
              />
            </li>
          ))}
        </ul>

        {mayCreate && (
          <div
            ref={form.formRef}
            data-testid="specialty-form"
            className="flex flex-col gap-4 border-t border-line pt-4"
          >
            <h3 className="text-label font-semibold text-ink">{t("specialties.add")}</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div onBlur={form.leave("name")}>
                <FormField
                  error={form.errors["name"]}
                  label="specialties.name"
                  htmlFor="specialty-name"
                  required
                >
                  <Input
                    id="specialty-name"
                    data-testid="specialty-field-name"
                    maxLength={80}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </FormField>
              </div>

              <div onBlur={form.leave("code")}>
                <FormField
                  error={form.errors["code"]}
                  label="specialties.code"
                  htmlFor="specialty-code"
                  hint={t("specialties.codeHint")}
                  required
                >
                  <Input
                    id="specialty-code"
                    data-testid="specialty-field-code"
                    dir="ltr"
                    maxLength={32}
                    value={code}
                    onChange={(event) => setCode(event.target.value.toLowerCase())}
                  />
                </FormField>
              </div>
            </div>

            <FormField
              label="specialties.chart"
              htmlFor="specialty-chart"
              hint={t("specialties.chartHint")}
              required
            >
              <Select
                id="specialty-chart"
                data-testid="specialty-field-chart"
                className="max-w-(--field-max)"
                value={chartType}
                onChange={(event) => setChartType(event.target.value as ChartType)}
                options={CHART_TYPES.map((type) => ({
                  value: type,
                  label: t(`specialties.charts.${type}`),
                }))}
              />
            </FormField>

            <div>
              <Button
                icon={<Icon name="plus" />}
                data-testid="specialty-add"
                aria-disabled={!form.isValid || create.isPending || undefined}
                isLoading={create.isPending}
                onClick={() => void add()}
              >
                {t("specialties.add")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
