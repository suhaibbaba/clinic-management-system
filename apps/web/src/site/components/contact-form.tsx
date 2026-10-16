import {
  DEFAULT_PHONE_COUNTRY,
  isPhoneCountry,
  joinPhone,
  type PhoneCountry,
} from "@shared/constants/phone";
import { createContactMessageSchema } from "@shared/schemas/website";
import { useId, useRef, useState, type FormEvent, type JSX, type ReactNode } from "react";
import { Alert, Button, cx } from "@web/booking/ui";
import { PhoneCountrySelect } from "@clinic/ui/components/phone-country-select";
import { siteApi, siteFailureKey } from "@web/site/api";
import { SiteIcon } from "@web/site/components/site-icon";
import { useSite } from "@web/site/hooks/use-site";
import { pick } from "@web/site/lib/text";

const EMPTY = { name: "", email: "", phone: "", topic: "", message: "" };

type ContactField = keyof typeof EMPTY;

const FIELD_BOX =
  "w-full rounded-control border-[1.5px] bg-surface text-field text-ink placeholder:text-ink-subtle";

const fieldTone = (error: string | undefined): string =>
  error
    ? "border-danger-600 shadow-field-error"
    : "border-line-strong hover:border-neutral-400 focus:border-primary-600 focus:shadow-field-focus";

function Labelled({
  id,
  label,
  error,
  hint,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly error: string | undefined;
  readonly hint?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && (
        <span id={`${id}-hint`} className="text-label text-ink-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="text-label font-medium text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}

function IconInput({
  id,
  icon,
  error,
  addon,
  ...rest
}: {
  readonly id: string;
  readonly icon: "user" | "mail" | "phone";
  readonly error: string | undefined;
  readonly addon?: ReactNode;
} & Omit<JSX.IntrinsicElements["input"], "id">): JSX.Element {
  return (
    <div dir={addon ? "ltr" : undefined} className="flex gap-2">
      {addon}
      <div className="relative flex-1">
        <SiteIcon
          name={icon}
          className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink-subtle"
        />
        <input
          id={id}
          {...(error && { "aria-invalid": true, "aria-describedby": `${id}-error` })}
          className={cx(FIELD_BOX, "min-h-(--control-h) ps-10 pe-3", fieldTone(error))}
          {...rest}
        />
      </div>
    </div>
  );
}

export function ContactForm(): JSX.Element {
  const { site, language, t, preview } = useSite();
  const base = useId();
  const [country, setCountry] = useState<PhoneCountry>(
    isPhoneCountry(site.clinic.country) ? site.clinic.country : DEFAULT_PHONE_COUNTRY,
  );
  const topics = site.content.contact.topics;
  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string>();
  const form = useRef<HTMLFormElement>(null);

  const body = {
    name: values.name.trim(),
    phone: joinPhone(country, values.phone) ?? "",
    email: values.email.trim() === "" ? null : values.email.trim(),
    topic: values.topic === "" ? null : values.topic,
    message: values.message.trim(),
  };
  const parsed = createContactMessageSchema.safeParse(body);
  const invalid = new Set(
    parsed.success ? [] : parsed.error.issues.map((issue) => String(issue.path[0])),
  );
  const errorFor = (field: Exclude<ContactField, "topic">): string | undefined =>
    touched && invalid.has(field) ? t(`contact.form.invalid.${field}`) : undefined;
  const typedWhole = /^\s*(\+|00)/.test(values.phone);
  const set = (field: ContactField) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setTouched(true);

    if (!parsed.success) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(),
      );
      return;
    }

    if (preview) {
      return;
    }

    setBusy(true);
    setFailure(undefined);

    try {
      await siteApi.sendMessage(site.clinic.slug, parsed.data);
      setSent(true);
      setValues(EMPTY);
      setTouched(false);
    } catch (error) {
      setFailure(t(siteFailureKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="site-contact-form"
      className="rounded-card border border-line bg-surface p-5 shadow-card md:p-7"
    >
      <h2 className="text-title font-bold text-primary-900">{t("contact.form.title")}</h2>
      <p className="mt-1 mb-5 text-value text-ink-muted">{t("contact.form.subtitle")}</p>

      {sent ? (
        <div className="flex flex-col items-start gap-4">
          <Alert tone="info" data-testid="site-contact-sent">
            {t("contact.form.sent")}
          </Alert>
          <Button
            variant="secondary"
            data-testid="site-contact-again"
            onClick={() => setSent(false)}
          >
            {t("contact.form.another")}
          </Button>
        </div>
      ) : (
        <form
          ref={form}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-4"
        >
          {failure && <Alert>{failure}</Alert>}

          <Labelled id={`${base}-name`} label={t("contact.form.name")} error={errorFor("name")}>
            <IconInput
              id={`${base}-name`}
              icon="user"
              data-testid="site-contact-name"
              autoComplete="name"
              value={values.name}
              error={errorFor("name")}
              onChange={(event) => set("name")(event.target.value)}
            />
          </Labelled>

          <div className="flex flex-col gap-4">
            <Labelled
              id={`${base}-phone`}
              label={t("contact.form.phone")}
              hint={t("contact.form.phoneHint")}
              error={errorFor("phone")}
            >
              <IconInput
                id={`${base}-phone`}
                icon="phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                addon={
                  typedWhole ? undefined : (
                    <PhoneCountrySelect
                      country={country}
                      onChange={setCountry}
                      language={language}
                      label={t("contact.form.country")}
                      data-testid="site-contact-country"
                    />
                  )
                }
                data-testid="site-contact-phone-field"
                {...(!errorFor("phone") && { "aria-describedby": `${base}-phone-hint` })}
                autoComplete="tel"
                value={values.phone}
                error={errorFor("phone")}
                onChange={(event) => set("phone")(event.target.value)}
              />
            </Labelled>

            <Labelled
              id={`${base}-email`}
              label={`${t("contact.form.email")} (${t("contact.form.optional")})`}
              error={errorFor("email")}
            >
              <IconInput
                id={`${base}-email`}
                icon="mail"
                type="email"
                dir="ltr"
                data-testid="site-contact-email-field"
                autoComplete="email"
                value={values.email}
                error={errorFor("email")}
                onChange={(event) => set("email")(event.target.value)}
              />
            </Labelled>
          </div>

          {topics.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-label font-medium text-ink">
                {t("contact.form.topic")} ({t("contact.form.optional")})
              </legend>
              <div className="flex flex-wrap gap-2" data-testid="site-contact-topics">
                {topics.map((topic) => (
                  <label
                    key={topic.ar}
                    className={cx(
                      "pill-text inline-flex min-h-(--control-h) cursor-pointer items-center rounded-pill border px-4 text-label font-medium transition-colors",
                      "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-600",
                      values.topic === topic.ar
                        ? "border-primary-600 bg-primary-600 text-ink-inverse"
                        : "border-line-strong bg-surface text-ink-muted hover:border-primary-300 hover:text-primary-700",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${base}-topic`}
                      value={topic.ar}
                      checked={values.topic === topic.ar}
                      onChange={() => set("topic")(topic.ar)}
                      className="sr-only"
                    />
                    {pick(topic, language)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <Labelled
            id={`${base}-message`}
            label={t("contact.form.message")}
            error={errorFor("message")}
          >
            <textarea
              id={`${base}-message`}
              data-testid="site-contact-message"
              rows={5}
              maxLength={2000}
              value={values.message}
              {...(errorFor("message") && {
                "aria-invalid": true,
                "aria-describedby": `${base}-message-error`,
              })}
              onChange={(event) => set("message")(event.target.value)}
              className={cx(FIELD_BOX, "px-3 py-2", fieldTone(errorFor("message")))}
            />
          </Labelled>

          {preview && (
            <p data-testid="site-contact-preview" className="text-label text-ink-muted">
              {t("contact.form.preview")}
            </p>
          )}

          <Button
            type="submit"
            full
            busy={busy}
            disabled={preview}
            data-testid="site-contact-send"
            className="rounded-pill"
          >
            {t("contact.form.send")}
          </Button>
        </form>
      )}
    </div>
  );
}
