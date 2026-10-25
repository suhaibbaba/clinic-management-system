import type { PortalAccount } from "@clinic/shared";
import {
  DEFAULT_PHONE_COUNTRY,
  isPhoneCountry,
  joinPhone,
  type PhoneCountry,
} from "@shared/constants/phone";
import { PORTAL_CODE_LENGTH } from "@shared/schemas/portal";
import { phoneSchema } from "@shared/schemas/common";
import { useId, useState, type FormEvent, type JSX } from "react";
import { PhoneCountrySelect } from "@clinic/ui/components/phone-country-select";
import { Alert, Button } from "@web/booking/ui";
import { isSignedOut, portalApi, siteFailureKey } from "@web/site/api";
import { IconInput, Labelled } from "@web/site/components/site-field";
import { SiteIcon } from "@web/site/components/site-icon";
import { useSite } from "@web/site/hooks/use-site";

export function PortalSignIn({
  onSignedIn,
}: {
  readonly onSignedIn: (account: PortalAccount) => void;
}): JSX.Element {
  const { site, language, t, preview } = useSite();
  const base = useId();
  const [country, setCountry] = useState<PhoneCountry>(
    isPhoneCountry(site.clinic.country) ? site.clinic.country : DEFAULT_PHONE_COUNTRY,
  );
  const [local, setLocal] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const phone = joinPhone(country, local) ?? "";
  const phoneValid = phoneSchema.safeParse(phone).success;
  const codeValid = new RegExp(`^\\d{${PORTAL_CODE_LENGTH}}$`).test(code.trim());
  const typedWhole = /^\s*(\+|00)/.test(local);

  const run = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setFailure(undefined);

    try {
      await work();
    } catch (error) {
      setFailure(isSignedOut(error) ? t("portal.wrongCode") : t(siteFailureKey(error)));
    } finally {
      setBusy(false);
    }
  };

  const askCode = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault();
    setTouched(true);

    if (!phoneValid || preview) {
      return;
    }

    await run(async () => {
      await portalApi.requestCode(site.clinic.slug, phone);
      setSentTo(phone);
      setCode("");
      setTouched(false);
    });
  };

  const verify = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setTouched(true);

    if (!codeValid || !sentTo) {
      return;
    }

    await run(async () => {
      onSignedIn(await portalApi.startSession(site.clinic.slug, sentTo, code.trim()));
    });
  };

  return (
    <div
      data-testid="site-portal-sign-in"
      className="mx-auto flex w-full max-w-(--form-max) flex-col gap-5 rounded-card border border-line bg-surface p-6 shadow-card md:p-8"
    >
      <span className="inline-flex size-14 items-center justify-center self-center rounded-pill bg-primary-50 text-primary-600">
        <SiteIcon name={sentTo ? "shield" : "user"} className="size-7" />
      </span>
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-title font-bold text-primary-900">
          {sentTo ? t("portal.codeTitle") : t("portal.signInTitle")}
        </h2>
        <p className="text-value text-ink-muted">
          {sentTo ? t("portal.codeIntro", { phone: sentTo }) : t("portal.signInIntro")}
        </p>
      </div>

      {sentTo ? (
        <form noValidate onSubmit={(event) => void verify(event)} className="flex flex-col gap-4">
          <Labelled
            id={`${base}-code`}
            label={t("portal.code")}
            error={touched && !codeValid ? t("portal.codeInvalid") : undefined}
          >
            <IconInput
              id={`${base}-code`}
              icon="shield"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={PORTAL_CODE_LENGTH}
              data-testid="site-portal-code"
              value={code}
              error={touched && !codeValid ? t("portal.codeInvalid") : undefined}
              onChange={(event) => setCode(event.target.value.replaceAll(/\D/g, ""))}
            />
          </Labelled>
          {failure && <Alert data-testid="site-portal-failure">{failure}</Alert>}
          <Button type="submit" full busy={busy} data-testid="site-portal-verify">
            {t("portal.verify")}
          </Button>
          <div className="flex flex-wrap justify-between gap-2 text-label">
            <button
              type="button"
              data-testid="site-portal-change-phone"
              onClick={() => {
                setSentTo(undefined);
                setFailure(undefined);
              }}
              className="cursor-pointer font-medium text-primary-700 hover:text-primary-900"
            >
              {t("portal.changePhone")}
            </button>
            <button
              type="button"
              data-testid="site-portal-resend"
              onClick={() => void askCode()}
              className="cursor-pointer font-medium text-primary-700 hover:text-primary-900"
            >
              {t("portal.resend")}
            </button>
          </div>
        </form>
      ) : (
        <form noValidate onSubmit={(event) => void askCode(event)} className="flex flex-col gap-4">
          <Labelled
            id={`${base}-phone`}
            label={t("contact.form.phone")}
            hint={t("portal.phoneHint")}
            error={touched && !phoneValid ? t("contact.form.invalid.phone") : undefined}
          >
            <IconInput
              id={`${base}-phone`}
              icon="phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              autoComplete="tel"
              addon={
                typedWhole ? undefined : (
                  <PhoneCountrySelect
                    country={country}
                    onChange={setCountry}
                    language={language}
                    label={t("contact.form.country")}
                    data-testid="site-portal-country"
                  />
                )
              }
              data-testid="site-portal-phone"
              value={local}
              error={touched && !phoneValid ? t("contact.form.invalid.phone") : undefined}
              onChange={(event) => setLocal(event.target.value)}
            />
          </Labelled>
          {failure && <Alert data-testid="site-portal-failure">{failure}</Alert>}
          {preview && <Alert tone="info">{t("contact.form.preview")}</Alert>}
          <Button type="submit" full busy={busy} data-testid="site-portal-send-code">
            {t("portal.sendCode")}
          </Button>
        </form>
      )}
    </div>
  );
}
