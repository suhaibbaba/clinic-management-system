import {
  AI_AUTOMATION_MODE,
  AI_AUTOMATION_MODES,
  AI_AUTOMATION_RULES,
  AI_OUTBOUND_TARGET,
  AI_RECIPIENT_CAP_MAX,
  type AiAutomationMode,
  type AiAutomationRule,
  type AiAutomationSettings,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, FormField, Icon, Input, SegmentedControl, useToast } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { outboundErrorKey } from "@web/features/assistant/messages";
import { useAutomationSettings, useSaveAutomationSettings } from "@web/features/assistant/queries";

// A draft of the form, not of the server: saved as a whole, so a half-typed number never reaches it.
export function AutomationRulesPanel(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const settings = useAutomationSettings();
  const save = useSaveAutomationSettings();
  const [draft, setDraft] = useState<AiAutomationSettings | null>(null);

  useEffect(() => {
    if (settings.data) {
      setDraft(settings.data);
    }
  }, [settings.data]);

  if (!draft) {
    return <Skeleton aria-hidden="true" className="h-96 w-full rounded-card" />;
  }

  const setRule = (rule: AiAutomationRule, patch: Record<string, number | AiAutomationMode>) =>
    setDraft((current) =>
      current
        ? { ...current, rules: { ...current.rules, [rule]: { ...current.rules[rule], ...patch } } }
        : current,
    );

  const modes = AI_AUTOMATION_MODES.map((mode) => ({
    value: mode,
    label: t(`assistantSettings.modes.${mode}`),
  }));

  return (
    <form
      data-testid="assistant-rules"
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(draft, {
          onSuccess: () => toast.success("assistantSettings.saved"),
          onError: (error) => toast.error(outboundErrorKey(error)),
        });
      }}
    >
      {AI_AUTOMATION_RULES.map((rule) => {
        const current = draft.rules[rule];

        return (
          <Card key={rule} data-testid={`assistant-rule-${rule}`} className="flex flex-col gap-4">
            <div>
              <h2 className="text-heading text-ink">
                {t(`assistantSettings.rules.${rule}.title`)}
              </h2>
              <p className="mt-1 text-label text-ink-muted">
                {t(`assistantSettings.rules.${rule}.hint`)}
              </p>
            </div>

            <SegmentedControl
              data-testid={`assistant-rule-${rule}-mode`}
              label={t("assistantSettings.mode")}
              options={modes}
              value={current.mode}
              onChange={(mode) => setRule(rule, { mode })}
            />

            {current.mode === AI_AUTOMATION_MODE.AUTO_SEND && (
              <p
                role="note"
                className="flex items-center gap-2 rounded-field bg-warning-50 px-3 py-2 text-label text-warning-800"
              >
                <Icon name="alert" />
                {t("assistantSettings.autoSendWarning")}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rule !== AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS && (
                <FormField label="assistantSettings.days" htmlFor={`rule-${rule}-days`}>
                  <NumberInput
                    id={`rule-${rule}-days`}
                    value={draft.rules[rule].days}
                    min={1}
                    max={365}
                    onValue={(days) => setRule(rule, { days })}
                  />
                </FormField>
              )}
              <FormField label="assistantSettings.cap" htmlFor={`rule-${rule}-cap`}>
                <NumberInput
                  id={`rule-${rule}-cap`}
                  value={current.cap}
                  min={1}
                  max={AI_RECIPIENT_CAP_MAX}
                  onValue={(cap) => setRule(rule, { cap })}
                />
              </FormField>
            </div>
          </Card>
        );
      })}

      <Card data-testid="assistant-caps" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          label="assistantSettings.recipientCap"
          htmlFor="assistant-recipient-cap"
          hint="assistantSettings.recipientCapHint"
        >
          <NumberInput
            id="assistant-recipient-cap"
            value={draft.recipientCap}
            min={1}
            max={AI_RECIPIENT_CAP_MAX}
            onValue={(recipientCap) => setDraft({ ...draft, recipientCap })}
          />
        </FormField>
        <FormField
          label="assistantSettings.dailyCap"
          htmlFor="assistant-daily-cap"
          hint="assistantSettings.dailyCapHint"
        >
          <NumberInput
            id="assistant-daily-cap"
            value={draft.dailyCap}
            min={1}
            max={5_000}
            onValue={(dailyCap) => setDraft({ ...draft, dailyCap })}
          />
        </FormField>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" data-testid="assistant-rules-save" disabled={save.isPending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

function NumberInput({
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
