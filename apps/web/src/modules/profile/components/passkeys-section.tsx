import { zodResolver } from "@hookform/resolvers/zod";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { registerPasskeySchema } from "@clinic/shared";
import type { JSX } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Input, useConfirm, useToast } from "@clinic/ui";
import { revealFirstError } from "@web/shared/lib/form-errors";
import { errorMessageKey } from "@web/shared/lib/api-error";
import { formatDate, formatDateTime } from "@web/shared/lib/format";
import { isPasskeyCancelled } from "@web/shared/lib/passkeys";
import { deviceName } from "@web/modules/profile/lib/device-name";
import { useAddPasskey, usePasskeys, useRemovePasskey } from "@web/modules/profile/queries";

const passkeyNameSchema = registerPasskeySchema.pick({ name: true });

interface PasskeyNameForm {
  name: string;
}

export function PasskeysSection(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const passkeys = usePasskeys();
  const add = useAddPasskey();
  const remove = useRemovePasskey();
  const { confirm, dialog } = useConfirm("profile-passkey-remove");
  const supported = browserSupportsWebAuthn();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<PasskeyNameForm>({
    mode: "onChange",
    resolver: zodResolver(passkeyNameSchema),
    defaultValues: { name: deviceName(navigator.userAgent) },
  });

  const onSubmit = handleSubmit(
    async ({ name }) => {
      try {
        await add.mutateAsync(name);
        reset({ name: "" });
        toast.success("profile.passkeys.added");
      } catch (error) {
        if (!isPasskeyCancelled(error)) {
          toast.error(errorMessageKey(error));
        }
      }
    },
    () => revealFirstError(),
  );

  return (
    <div data-testid="profile-passkeys">
      <h3 className="flex items-center gap-2 text-value font-semibold text-ink">
        <Icon name="passkey" className="text-ink-muted" />
        {t("profile.passkeys.title")}
      </h3>
      <p className="mt-1 text-value text-ink-muted">{t("profile.passkeys.subtitle")}</p>

      {passkeys.data && passkeys.data.length > 0 ? (
        <ul data-testid="profile-passkeys-list" className="mt-3 flex flex-col divide-y divide-line">
          {passkeys.data.map((passkey) => (
            <li
              key={passkey.id}
              data-testid={`profile-passkey-${passkey.id}`}
              className="flex items-center gap-3 py-2.5"
            >
              <Icon name="passkey" className="shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-value font-medium text-ink">{passkey.name}</p>
                <p className="text-meta text-ink-muted">
                  {t("profile.passkeys.addedOn", { date: formatDate(passkey.createdAt) })}
                  {" · "}
                  {passkey.lastUsedAt
                    ? t("profile.passkeys.lastUsed", { date: formatDateTime(passkey.lastUsedAt) })
                    : t("profile.passkeys.neverUsed")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="trash" />}
                data-testid={`profile-passkey-${passkey.id}-remove`}
                onClick={() =>
                  confirm({
                    title: "profile.passkeys.removeTitle",
                    titleValues: { name: passkey.name },
                    consequences: [t("profile.passkeys.removeConsequence")],
                    confirmLabel: "profile.passkeys.remove",
                    tone: "danger",
                    onConfirm: async () => {
                      try {
                        await remove.mutateAsync(passkey.id);
                        toast.success("profile.passkeys.removed");
                      } catch (error) {
                        toast.error(errorMessageKey(error));
                      }
                    },
                  })
                }
              >
                {t("profile.passkeys.remove")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        passkeys.isSuccess && (
          <p data-testid="profile-passkeys-empty" className="mt-3 text-value text-ink-muted">
            {t("profile.passkeys.empty")}
          </p>
        )
      )}

      {supported ? (
        <form
          data-testid="profile-passkey-form"
          className="mt-4 flex max-w-(--form-max) flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={onSubmit}
          noValidate
        >
          <div className="min-w-0 flex-1">
            <FormField label="profile.passkeys.name" htmlFor="passkey-name" error={errors.name}>
              <Input
                id="passkey-name"
                data-testid="profile-passkey-name"
                placeholder={t("profile.passkeys.namePlaceholder")}
                hasError={errors.name !== undefined}
                {...register("name")}
              />
            </FormField>
          </div>
          <Button
            type="submit"
            icon={<Icon name="plus" />}
            data-testid="profile-passkey-add"
            isLoading={isSubmitting}
            aria-disabled={!isValid || isSubmitting || undefined}
          >
            {t("profile.passkeys.add")}
          </Button>
        </form>
      ) : (
        <p data-testid="profile-passkeys-unsupported" className="mt-4 text-value text-ink-muted">
          {t("profile.passkeys.unsupported")}
        </p>
      )}

      {dialog}
    </div>
  );
}
