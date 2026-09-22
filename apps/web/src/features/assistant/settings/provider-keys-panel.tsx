import {
  CLINIC_SECRET_KIND,
  type ClinicSecretKind,
  type UpdateClinicSecretsInput,
} from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, FormField, Icon, PasswordInput, useToast } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { outboundErrorKey } from "@web/features/assistant/messages";
import { useClinicSecrets, useSaveClinicSecrets } from "@web/features/assistant/queries";
import { formatDateTime } from "@web/lib/format";

const GROUPS: readonly { readonly id: string; readonly kinds: readonly ClinicSecretKind[] }[] = [
  { id: "openai", kinds: [CLINIC_SECRET_KIND.OPENAI_API_KEY] },
  {
    id: "whatsapp",
    kinds: [
      CLINIC_SECRET_KIND.WHATSAPP_ACCESS_TOKEN,
      CLINIC_SECRET_KIND.WHATSAPP_PHONE_NUMBER_ID,
      CLINIC_SECRET_KIND.WHATSAPP_TEMPLATE_NAME,
    ],
  },
];

// Write-only: the API never returns a stored value, so nothing here is ever filled in from it. What
// was typed is dropped the moment it is saved.
export function ProviderKeysPanel(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const secrets = useClinicSecrets();
  const save = useSaveClinicSecrets();
  const [typed, setTyped] = useState<Partial<Record<ClinicSecretKind, string>>>({});

  if (!secrets.data) {
    return <Skeleton aria-hidden="true" className="h-96 w-full rounded-card" />;
  }

  const { encryptionAvailable } = secrets.data;

  const submit = (body: UpdateClinicSecretsInput): void => {
    save.mutate(body, {
      onSuccess: () => {
        setTyped({});
        toast.success("assistantSettings.keys.saved");
      },
      onError: (error) => toast.error(outboundErrorKey(error)),
    });
  };

  return (
    <div data-testid="assistant-keys" className="flex flex-col gap-4">
      {!encryptionAvailable && (
        <p
          role="note"
          data-testid="assistant-keys-unavailable"
          className="flex items-center gap-2 rounded-field bg-warning-50 px-3 py-2 text-label text-warning-800"
        >
          <Icon name="lock" />
          {t("assistantSettings.keys.unavailable")}
        </p>
      )}

      {GROUPS.map((group) => {
        const entered = Object.fromEntries(
          group.kinds.flatMap((kind) => {
            const value = typed[kind]?.trim();

            return value ? [[kind, value]] : [];
          }),
        ) as UpdateClinicSecretsInput;
        const anySet = group.kinds.some((kind) => secrets.data.secrets[kind]?.set);

        return (
          <Card
            key={group.id}
            data-testid={`assistant-keys-${group.id}`}
            className="flex flex-col gap-4"
          >
            <div>
              <h2 className="text-heading text-ink">
                {t(`assistantSettings.keys.groups.${group.id}.title`)}
              </h2>
              <p className="mt-1 text-label text-ink-muted">
                {t(`assistantSettings.keys.groups.${group.id}.hint`)}
              </p>
            </div>

            {group.kinds.map((kind) => {
              const status = secrets.data.secrets[kind];

              return (
                <FormField
                  key={kind}
                  label={`assistantSettings.keys.kinds.${kind}`}
                  htmlFor={`secret-${kind}`}
                  hint={
                    status?.set && status.updatedAt
                      ? t("assistantSettings.keys.current", {
                          hint: status.hint ?? "",
                          date: formatDateTime(status.updatedAt),
                        })
                      : t("assistantSettings.keys.notSet")
                  }
                >
                  <PasswordInput
                    id={`secret-${kind}`}
                    data-testid={`secret-${kind}`}
                    autoComplete="new-password"
                    spellCheck={false}
                    dir="ltr"
                    disabled={!encryptionAvailable}
                    placeholder={status?.set ? `…${status.hint ?? ""}` : ""}
                    value={typed[kind] ?? ""}
                    onChange={(event) =>
                      setTyped((current) => ({ ...current, [kind]: event.target.value }))
                    }
                  />
                </FormField>
              );
            })}

            <div className="flex flex-wrap justify-end gap-2">
              {anySet && (
                <Button
                  variant="secondary"
                  data-testid={`assistant-keys-${group.id}-clear`}
                  disabled={save.isPending}
                  onClick={() => {
                    if (
                      !window.confirm(t(`assistantSettings.keys.groups.${group.id}.confirmClear`))
                    ) {
                      return;
                    }

                    submit(
                      Object.fromEntries(
                        group.kinds.map((kind) => [kind, null]),
                      ) as UpdateClinicSecretsInput,
                    );
                  }}
                >
                  {t("assistantSettings.keys.clear")}
                </Button>
              )}
              <Button
                data-testid={`assistant-keys-${group.id}-save`}
                disabled={
                  !encryptionAvailable || save.isPending || Object.keys(entered).length === 0
                }
                onClick={() => submit(entered)}
              >
                {t("common.save")}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
