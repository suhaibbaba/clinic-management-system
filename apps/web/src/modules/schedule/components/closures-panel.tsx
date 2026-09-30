import {
  createClinicClosureSchema,
  type ClinicClosure,
  type ConflictingAppointment,
} from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  DateRangePicker,
  EmptyState,
  FormField,
  Icon,
  Input,
  Ltr,
  Modal,
  Switch,
  type DateRange,
  useConfirm,
  useToast,
} from "@clinic/ui";
import { ConflictDialog } from "@web/modules/schedule/components/conflict-dialog";
import {
  scheduleConflicts,
  useClinicClosures,
  useCreateClosure,
  useDeleteClosure,
} from "@web/modules/schedule/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate } from "@web/shared/lib/format";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";

export function ClosuresPanel({ canEdit }: { readonly canEdit: boolean }): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const closures = useClinicClosures({ limit: 50 });
  const createClosure = useCreateClosure();
  const deleteClosure = useDeleteClosure();
  const { confirm, dialog } = useConfirm("closures-confirm-remove");

  const [adding, setAdding] = useState(false);
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [reason, setReason] = useState("");
  const [isAnnual, setIsAnnual] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictingAppointment[] | null>(null);

  const body = {
    startsOn: range.from,
    endsOn: range.to === "" ? range.from : range.to,
    reason: reason.trim(),
    isAnnual,
  };

  const form = useFormErrors(schemaErrors(createClinicClosureSchema, body));
  const { errors } = form;

  const reset = (): void => {
    setRange({ from: "", to: "" });
    setReason("");
    setIsAnnual(false);
    setConflicts(null);
    form.reset();
  };

  const save = async (choice?: { force: boolean; cancelAppointments: boolean }): Promise<void> => {
    if (!choice && !form.check()) {
      return;
    }

    try {
      const result = await createClosure.mutateAsync({
        body,
        ...(choice && { choice }),
      });

      if (result.cancelledAppointments > 0) {
        toast.success("schedule.closures.addedAndCancelled", {
          count: result.cancelledAppointments,
        });
      } else {
        toast.success("schedule.closures.added");
      }
      setAdding(false);
      reset();
    } catch (error) {
      const clash = scheduleConflicts(error);

      if (clash) {
        setConflicts(clash);
        return;
      }

      toast.error(...errorToast(error));
    }
  };

  const remove = (closure: ClinicClosure): void =>
    confirm({
      title: "schedule.closures.confirmRemove.title",
      consequences: [t("schedule.closures.confirmRemove.consequence")],
      onConfirm: async () => {
        try {
          await deleteClosure.mutateAsync(closure.id);
          toast.success("schedule.closures.removed");
        } catch (error) {
          toast.error(...errorToast(error));
          throw error;
        }
      },
    });

  const rows = closures.data?.items ?? [];

  return (
    <>
      {dialog}
      <div
        data-testid="closures-panel"
        className="mb-3 flex flex-wrap items-center justify-between gap-2"
      >
        <p className="text-value font-medium text-ink">{t("schedule.closures.title")}</p>

        {canEdit && (
          <Button
            icon={<Icon name="plus" />}
            size="sm"
            variant="secondary"
            data-testid="closures-add"
            onClick={() => {
              reset();
              setAdding(true);
            }}
          >
            {t("schedule.closures.add")}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="calendar"
          data-testid="closures-empty"
          title="schedule.closures.empty"
          hint="schedule.closures.emptyHint"
        />
      ) : (
        <ul data-testid="closures-list" className="flex flex-col gap-2">
          {rows.map((closure) => (
            <li
              key={closure.id}
              data-testid={`closure-${closure.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-canvas px-3 py-2"
            >
              <span className="flex min-w-0 flex-col leading-label">
                <span className="truncate text-value font-medium text-ink">{closure.reason}</span>
                <Ltr className="text-label tabular-nums text-ink-muted">
                  {closure.startsOn === closure.endsOn
                    ? formatDate(closure.startsOn)
                    : `${formatDate(closure.startsOn)} — ${formatDate(closure.endsOn)}`}
                </Ltr>
              </span>

              <span className="flex items-center gap-2">
                {closure.isAnnual && (
                  <Badge tone="info" data-testid="closure-annual">
                    {t("schedule.closures.annual")}
                  </Badge>
                )}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="quiet"
                    icon={<Icon name="trash" />}
                    data-testid="closure-delete"
                    onClick={() => remove(closure)}
                  >
                    {t("common.delete")}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Modal
        data-testid="closure-add-modal"
        open={adding}
        onOpenChange={(open) => {
          setAdding(open);
          if (!open) {
            reset();
          }
        }}
        title="schedule.closures.add"
        footer={
          <>
            <Button
              icon={<Icon name="x" />}
              variant="secondary"
              data-testid="closure-add-cancel"
              onClick={() => setAdding(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              icon={<Icon name="check" />}
              data-testid="closure-add-save"
              aria-disabled={!form.isValid || undefined}
              isLoading={createClosure.isPending}
              onClick={() => void save()}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div ref={form.formRef} className="flex flex-col gap-4">
          <div
            onBlur={(event) => {
              form.leave("startsOn")(event);
              form.leave("endsOn")(event);
            }}
          >
            <FormField
              label="schedule.closures.dates"
              htmlFor="closure-dates"
              error={errors["startsOn"] ?? errors["endsOn"]}
            >
              <DateRangePicker
                id="closure-dates"
                data-testid="closure-field-dates"
                label={t("schedule.closures.dates")}
                value={range}
                onChange={setRange}
              />
            </FormField>
          </div>

          <div onBlur={form.leave("reason")}>
            <FormField
              label="schedule.closures.reason"
              htmlFor="closure-reason"
              error={errors["reason"]}
            >
              <Input
                id="closure-reason"
                data-testid="closure-field-reason"
                placeholder={t("schedule.closures.reasonPlaceholder")}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
          </div>

          <div>
            <Switch
              data-testid="closure-field-annual"
              checked={isAnnual}
              label={t("schedule.closures.annual")}
              onCheckedChange={setIsAnnual}
            />
            <p className="mt-1 text-label text-ink-subtle">{t("schedule.closures.annualHint")}</p>
          </div>
        </div>
      </Modal>

      <ConflictDialog
        open={conflicts !== null}
        onOpenChange={(open) => !open && setConflicts(null)}
        conflicts={conflicts ?? []}
        isSaving={createClosure.isPending}
        onCancelThem={() => void save({ force: true, cancelAppointments: true })}
        onKeepThem={() => void save({ force: true, cancelAppointments: false })}
      />
    </>
  );
}
