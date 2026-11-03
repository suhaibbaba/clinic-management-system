import {
  NOTIFICATION_CHANNELS,
  type SaveClinicKeysInput,
  type VendorClinicDetail,
} from "@clinic/shared";
import { Button } from "@clinic/ui/components/button";
import { useConfirm } from "@clinic/ui/components/confirm-dialog";
import { FormField } from "@clinic/ui/components/form-field";
import { Icon } from "@clinic/ui/components/icon";
import { Input } from "@clinic/ui/components/input";
import { PasswordInput } from "@clinic/ui/components/password-input";
import { SaveBar } from "@clinic/ui/components/save-bar";
import { SegmentedControl } from "@clinic/ui/components/segmented-control";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { googleRedirectUri } from "@web/vendor/lib/domain";
import { initialKeysDraft, keysChanges, keysValid, type KeysDraft } from "@web/vendor/lib/keys";
import { vendorErrorKey } from "@web/vendor/lib/vendor-api-error";
import { useSaveKeys, useSaveMessageChannel } from "@web/vendor/queries";

type KeyGroup = "email" | "google";

const CLEARED: Readonly<Record<KeyGroup, SaveClinicKeysInput>> = {
  email: { emailFrom: null, resendApiKey: null },
  google: { googleClientId: null, googleClientSecret: null },
};

export function KeysPanel({ detail }: { readonly detail: VendorClinicDetail }): JSX.Element {
  const { t } = useTranslation();
  const save = useSaveKeys(detail.id);
  const saveChannel = useSaveMessageChannel(detail.id);
  const { confirm, dialog } = useConfirm("vendor-keys-confirm");
  const { keys } = detail;
  const [draft, setDraft] = useState<KeysDraft>(() => initialKeysDraft(keys));
  const changes = keysChanges(keys, draft);
  const dirty = Object.keys(changes).length > 0;
  const invalid = !keysValid(changes);
  const update = (patch: Partial<KeysDraft>): void =>
    setDraft((current) => ({ ...current, ...patch }));
  const hasGroup: Readonly<Record<KeyGroup, boolean>> = {
    email: keys.emailFrom !== null || keys.resendApiKeyHint !== null,
    google: keys.googleClientId !== null || keys.googleClientSecretHint !== null,
  };

  const clear = (group: KeyGroup): void =>
    confirm({
      title: `vendor.keys.${group}.clearTitle`,
      tone: "danger",
      confirmLabel: "vendor.keys.clear",
      consequences: [t(`vendor.keys.${group}.clearBody`)],
      onConfirm: () => save.mutateAsync(CLEARED[group]),
    });

  const secretHint = (hint: string | null): string =>
    hint === null ? t("vendor.keys.notSet") : t("vendor.keys.current", { hint });

  return (
    <div className="flex flex-col gap-5" data-testid="vendor-keys">
      {dialog}
      {!keys.encryptionAvailable && (
        <p
          role="note"
          className="flex items-center gap-2 rounded-panel bg-warning-50 p-3 text-label text-warning-800"
          data-testid="vendor-keys-unavailable"
        >
          <Icon name="lock" />
          {t("vendor.keys.unavailable")}
        </p>
      )}

      <section
        className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
        data-testid="vendor-keys-channel"
      >
        <div>
          <h2 className="text-section font-semibold text-ink">{t("vendor.keys.channel.title")}</h2>
          <p className="mt-1 text-label text-ink-muted">{t("vendor.keys.channel.body")}</p>
        </div>
        <SegmentedControl
          data-testid="vendor-keys-channel-choice"
          className="self-start"
          label={t("vendor.keys.channel.title")}
          value={
            saveChannel.isPending
              ? (saveChannel.variables ?? detail.messageChannel)
              : detail.messageChannel
          }
          options={NOTIFICATION_CHANNELS.map((channel) => ({
            value: channel,
            label: t(`vendor.keys.channel.${channel}`),
          }))}
          onChange={(channel) => {
            if (channel !== detail.messageChannel && !saveChannel.isPending) {
              saveChannel.mutate(channel);
            }
          }}
        />
        {saveChannel.isError && (
          <p role="alert" className="text-label text-danger-700">
            {t(vendorErrorKey(saveChannel.error))}
          </p>
        )}
      </section>

      <section
        className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
        data-testid="vendor-keys-email"
      >
        <div>
          <h2 className="text-section font-semibold text-ink">{t("vendor.keys.email.title")}</h2>
          <p className="mt-1 text-label text-ink-muted">{t("vendor.keys.email.body")}</p>
        </div>
        <div className="flex max-w-(--form-max) flex-col gap-4">
          <FormField
            label="vendor.keys.email.from"
            htmlFor="vendor-keys-from"
            hint="vendor.keys.email.fromHint"
          >
            <Input
              id="vendor-keys-from"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              placeholder={t("vendor.keys.email.fromPlaceholder")}
              value={draft.emailFrom}
              onChange={(event) => update({ emailFrom: event.target.value })}
              data-testid="vendor-keys-from"
            />
          </FormField>
          <FormField
            label="vendor.keys.email.apiKey"
            htmlFor="vendor-keys-resend"
            hint={secretHint(keys.resendApiKeyHint)}
          >
            <PasswordInput
              id="vendor-keys-resend"
              dir="ltr"
              autoComplete="new-password"
              spellCheck={false}
              aria-disabled={!keys.encryptionAvailable}
              readOnly={!keys.encryptionAvailable}
              placeholder={keys.resendApiKeyHint ? `…${keys.resendApiKeyHint}` : ""}
              value={draft.resendApiKey}
              onChange={(event) => update({ resendApiKey: event.target.value })}
              data-testid="vendor-keys-resend"
            />
          </FormField>
        </div>
        {hasGroup.email && (
          <Button
            variant="secondary"
            className="self-start text-danger-700"
            onClick={() => clear("email")}
            data-testid="vendor-keys-email-clear"
          >
            {t("vendor.keys.clear")}
          </Button>
        )}
      </section>

      <section
        className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
        data-testid="vendor-keys-google"
      >
        <div>
          <h2 className="text-section font-semibold text-ink">{t("vendor.keys.google.title")}</h2>
          <p className="mt-1 text-label text-ink-muted">{t("vendor.keys.google.body")}</p>
        </div>
        {detail.appDomain ? (
          <dl
            className="grid gap-2 text-label sm:grid-cols-[auto_1fr]"
            data-testid="vendor-keys-google-uris"
          >
            <dt className="text-ink-muted">{t("vendor.keys.google.origin")}</dt>
            <dd dir="ltr" className="break-all text-ink">{`https://${detail.appDomain}`}</dd>
            <dt className="text-ink-muted">{t("vendor.keys.google.redirect")}</dt>
            <dd dir="ltr" className="break-all text-ink">
              {googleRedirectUri(detail.appDomain)}
            </dd>
          </dl>
        ) : (
          <p
            role="note"
            className="rounded-panel bg-sunken p-3 text-label text-ink"
            data-testid="vendor-keys-google-needs-domain"
          >
            {t("vendor.keys.google.needsDomain")}
          </p>
        )}
        <div className="flex max-w-(--form-max) flex-col gap-4">
          <FormField label="vendor.keys.google.clientId" htmlFor="vendor-keys-google-id">
            <Input
              id="vendor-keys-google-id"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              value={draft.googleClientId}
              onChange={(event) => update({ googleClientId: event.target.value })}
              data-testid="vendor-keys-google-id"
            />
          </FormField>
          <FormField
            label="vendor.keys.google.clientSecret"
            htmlFor="vendor-keys-google-secret"
            hint={secretHint(keys.googleClientSecretHint)}
          >
            <PasswordInput
              id="vendor-keys-google-secret"
              dir="ltr"
              autoComplete="new-password"
              spellCheck={false}
              aria-disabled={!keys.encryptionAvailable}
              readOnly={!keys.encryptionAvailable}
              placeholder={keys.googleClientSecretHint ? `…${keys.googleClientSecretHint}` : ""}
              value={draft.googleClientSecret}
              onChange={(event) => update({ googleClientSecret: event.target.value })}
              data-testid="vendor-keys-google-secret"
            />
          </FormField>
        </div>
        {hasGroup.google && (
          <Button
            variant="secondary"
            className="self-start text-danger-700"
            onClick={() => clear("google")}
            data-testid="vendor-keys-google-clear"
          >
            {t("vendor.keys.clear")}
          </Button>
        )}
      </section>

      <SaveBar
        data-testid="vendor-keys-bar"
        visible={dirty}
        saving={save.isPending}
        invalid={invalid}
        onSave={() => !invalid && save.mutate(changes)}
        onDiscard={() => setDraft(initialKeysDraft(keys))}
      />

      {dirty && invalid && (
        <p role="alert" className="text-label text-danger-700" data-testid="vendor-keys-invalid">
          {t("vendor.keys.invalid")}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-label text-danger-700">
          {t(vendorErrorKey(save.error))}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="text-label text-success-700">
          {t("vendor.keys.saved")}
        </p>
      )}
    </div>
  );
}
