import {
  DEFAULT_PHONE_COUNTRY,
  isPhoneCountry,
  joinPhone,
  type PhoneCountry,
} from "@shared/constants/phone";
import { createContactMessageSchema } from "@shared/schemas/website";
import { useId, useRef, useState, type FormEvent, type JSX } from "react";
import { Alert, Button, cx } from "@web/booking/ui";
import { PhoneCountrySelect } from "@clinic/ui/components/phone-country-select";
import { siteApi, siteFailureKey } from "@web/site/api";
import { IconInput, Labelled } from "@web/site/components/site-field";
import { useSite } from "@web/site/hooks/use-site";
import { FIELD_BOX, fieldTone } from "@web/site/lib/field-style";
import { revealField } from "@web/site/lib/reveal-field";
import { pick, topicValue } from "@web/site/lib/text";

const EMPTY = { name: "", phone: "", topic: "", message: "" };

type ContactField = keyof typeof EMPTY;

export function ContactForm(): JSX.Element {
  const { site, language, languages, t, preview } = useSite();
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
      requestAnimationFrame(() => {
        const first = form.current?.querySelector<HTMLElement>("[aria-invalid=true]");

        if (first) {
          revealField(first.closest<HTMLElement>("[data-part=labelled]") ?? first, first);
        }
      });
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Labelled id={`${base}-name`} label={t("contact.form.name")} error={errorFor("name")}>
              <IconInput
                id={`${base}-name`}
                icon="user"
                data-testid="site-contact-name"
                autoComplete="name"
                placeholder={t("contact.form.placeholder.name")}
                value={values.name}
                error={errorFor("name")}
                onChange={(event) => set("name")(event.target.value)}
              />
            </Labelled>

            <Labelled
              id={`${base}-phone`}
              label={t("contact.form.phone")}
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
                autoComplete="tel"
                placeholder={t("contact.form.placeholder.phone")}
                value={values.phone}
                error={errorFor("phone")}
                onChange={(event) => set("phone")(event.target.value)}
              />
            </Labelled>
          </div>

          {topics.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-label font-medium text-ink">
                {t("contact.form.topic")} ({t("contact.form.optional")})
              </legend>
              <div className="flex flex-wrap gap-2" data-testid="site-contact-topics">
                {topics.map((topic, index) => {
                  const value = topicValue(topic, site.clinic.locale);

                  return (
                    <label
                      key={`${index}-${value}`}
                      className={cx(
                        "pill-text inline-flex min-h-(--control-h) cursor-pointer items-center rounded-pill border px-4 text-label font-medium transition-colors",
                        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-600",
                        values.topic === value
                          ? "border-primary-600 bg-primary-600 text-ink-inverse"
                          : "border-line-strong bg-surface text-ink-muted hover:border-primary-300 hover:text-primary-700",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${base}-topic`}
                        value={value}
                        checked={values.topic === value}
                        onChange={() => set("topic")(value)}
                        className="sr-only"
                      />
                      {pick(topic, language, languages)}
                    </label>
                  );
                })}
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
              placeholder={t("contact.form.placeholder.message")}
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
