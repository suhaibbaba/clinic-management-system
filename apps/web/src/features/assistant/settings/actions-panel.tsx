import {
  AI_ACTION_BASE_TIER,
  AI_ACTION_TOOLS,
  AI_RISK_TIERS,
  type AiActionsSettings,
  type AiActionTool,
  type AiRiskTier,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, FormField, Input, SegmentedControl, Switch, useToast } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { actionRefusalKey } from "@web/features/assistant/messages";
import { useActionsSettings, useSaveActionsSettings } from "@web/features/assistant/queries";

// A clinic may only tighten: a tool can be switched off or asked for more confirmation, never less
// than the code gives it — the options below the floor are not offered, and the server refuses them.
export function ActionsPanel(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const settings = useActionsSettings();
  const save = useSaveActionsSettings();
  const [draft, setDraft] = useState<AiActionsSettings | null>(null);

  useEffect(() => {
    if (settings.data) {
      setDraft(settings.data);
    }
  }, [settings.data]);

  if (!draft) {
    return <Skeleton aria-hidden="true" className="h-96 w-full rounded-card" />;
  }

  const setEnabled = (tool: AiActionTool, enabled: boolean): void =>
    setDraft({
      ...draft,
      disabled: enabled
        ? draft.disabled.filter((name) => name !== tool)
        : [...draft.disabled, tool],
    });

  const setTier = (tool: AiActionTool, tier: AiRiskTier): void =>
    setDraft({ ...draft, minTier: { ...draft.minTier, [tool]: tier } });

  return (
    <form
      data-testid="assistant-actions"
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(draft, {
          onSuccess: () => toast.success("assistantSettings.saved"),
          onError: (error) => toast.error(actionRefusalKey(error)),
        });
      }}
    >
      <Card className="flex flex-col divide-y divide-line p-0">
        {AI_ACTION_TOOLS.map((tool) => {
          const floor = AI_ACTION_BASE_TIER[tool];
          const enabled = !draft.disabled.includes(tool);
          const options = AI_RISK_TIERS.filter(
            (tier) => AI_RISK_TIERS.indexOf(tier) >= AI_RISK_TIERS.indexOf(floor),
          ).map((tier) => ({ value: tier, label: t(`assistant.action.tiers.${tier}`) }));

          return (
            <div
              key={tool}
              data-testid={`assistant-action-${tool}`}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <Switch
                data-testid={`assistant-action-${tool}-enabled`}
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(tool, checked)}
                label={t(`assistantSettings.actions.tools.${tool}`)}
              />
              {enabled && (
                <SegmentedControl
                  data-testid={`assistant-action-${tool}-tier`}
                  label={t("assistantSettings.actions.tier")}
                  options={options}
                  value={draft.minTier[tool] ?? floor}
                  onChange={(tier) => setTier(tool, tier)}
                  className="ms-auto"
                />
              )}
            </div>
          );
        })}
      </Card>

      <Card className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          label="assistantSettings.actions.paymentTypedAbove"
          htmlFor="assistant-payment-typed"
          hint="assistantSettings.actions.paymentTypedAboveHint"
        >
          <WholeNumberInput
            id="assistant-payment-typed"
            value={draft.paymentTypedAbove}
            min={1}
            max={99_999_999}
            onValue={(paymentTypedAbove) => setDraft({ ...draft, paymentTypedAbove })}
          />
        </FormField>
        <FormField
          label="assistantSettings.actions.cancelTypedAbove"
          htmlFor="assistant-cancel-typed"
          hint="assistantSettings.actions.cancelTypedAboveHint"
        >
          <WholeNumberInput
            id="assistant-cancel-typed"
            value={draft.cancelTypedAbove}
            min={0}
            max={50}
            onValue={(cancelTypedAbove) => setDraft({ ...draft, cancelTypedAbove })}
          />
        </FormField>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" data-testid="assistant-actions-save" disabled={save.isPending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

function WholeNumberInput({
  id,
  value,
  min,
  max,
  onValue,
}: {
  readonly id: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onValue: (value: number) => void;
}): JSX.Element {
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      value={value}
      onChange={(event) => {
        const next = Number.parseInt(event.target.value, 10);

        if (Number.isInteger(next)) {
          onValue(Math.min(max, Math.max(min, next)));
        }
      }}
    />
  );
}
