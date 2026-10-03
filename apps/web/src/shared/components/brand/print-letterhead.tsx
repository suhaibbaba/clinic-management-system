import { documentSettings, personName, type Clinic } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@web/shared/components/brand/logo";
import { PAGE_MARK, TOTAL_MARK } from "@web/shared/constants/print";
import { formatDate, formatDateTime } from "@web/shared/lib/format";
import { printPageCss } from "@web/shared/lib/print";

export function PrintLetterhead({
  clinic,
  title,
  details = [],
}: {
  readonly clinic: Clinic | undefined;
  readonly title: string;
  readonly details?: readonly string[];
}): JSX.Element {
  const { t } = useTranslation();
  const [now] = useState(() => new Date().toISOString());

  const language = documentSettings(clinic?.settings).language;
  const name = personName(clinic?.name, language);
  const otherName = personName(clinic?.name, language === "ar" ? "en" : "ar");
  const contact = [
    { key: "address", text: clinic?.address, ltr: false },
    { key: "phone", text: clinic?.phone, ltr: true },
    { key: "email", text: clinic?.email, ltr: true },
  ].filter((entry) => entry.text);

  return (
    <>
      <style>
        {printPageCss({
          name,
          title,
          printed: t("print.printed", { at: `\u2066${formatDateTime(now)}\u2069` }),
          page: t("print.page", { page: PAGE_MARK, total: TOTAL_MARK }),
        })}
      </style>

      <header data-testid="print-letterhead" className="print-letterhead">
        <div className="print-brand">
          {clinic?.logoUrl && <Logo size="print" src={clinic.logoUrl} className="print-logo" />}
          <div className="print-names">
            <h1 data-testid="print-clinic-name" className="print-clinic-name">
              {name}
            </h1>
            {otherName !== name && (
              <p className="print-clinic-other" dir="auto">
                {otherName}
              </p>
            )}
          </div>
        </div>

        <div className="print-document">
          <h2 data-testid="print-title" className="print-title">
            {title}
          </h2>
          {details.map((line) => (
            <p key={line} className="print-detail" dir="ltr">
              {line}
            </p>
          ))}
          <p data-testid="print-issued" className="print-issued" dir="ltr">
            {formatDate(now)}
          </p>
        </div>
      </header>

      {contact.length > 0 && (
        <p data-testid="print-clinic-contact" className="print-clinic-contact">
          {contact.map((entry) => (
            <span key={entry.key} dir={entry.ltr ? "ltr" : undefined}>
              {entry.text}
            </span>
          ))}
        </p>
      )}

      <div className="print-rule" aria-hidden="true" />
    </>
  );
}
