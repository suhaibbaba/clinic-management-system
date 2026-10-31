import { isCheckablePhone, WHATSAPP_STATUS, type WhatsAppStatus } from "@clinic/shared";
import { Icon, PhoneInput, type PhoneInputProps } from "@clinic/ui";
import { useRef, useState, type FocusEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { ellipsis } from "@web/i18n/ellipsis";
import { cn } from "@clinic/ui/lib/cn";
import { useStartWhatsAppCheck, useWhatsAppCheck } from "@web/shared/queries/whatsapp-checks";

const NOTE: Readonly<Partial<Record<WhatsAppStatus, string>>> = {
  [WHATSAPP_STATUS.UNAVAILABLE]: "whatsappCheck.unavailableNote",
  [WHATSAPP_STATUS.ERROR]: "whatsappCheck.errorNote",
};

export interface WhatsAppPhoneInputProps extends PhoneInputProps {
  readonly checkWhatsApp?: boolean | undefined;
}

export function WhatsAppPhoneInput({
  checkWhatsApp = false,
  value,
  onBlur,
  "data-testid": testId,
  ...props
}: WhatsAppPhoneInputProps): JSX.Element {
  const { t } = useTranslation();
  const [subject, setSubject] = useState<string | null>(() =>
    isCheckablePhone(value) ? value : null,
  );
  const lastSent = useRef<string | null>(null);
  const start = useStartWhatsAppCheck();
  const shown = checkWhatsApp && subject !== null && subject === value ? subject : null;
  const { data } = useWhatsAppCheck(shown);

  const onLeave = (event: FocusEvent<HTMLInputElement>): void => {
    onBlur?.(event);

    if (!checkWhatsApp || !isCheckablePhone(value)) {
      return;
    }

    setSubject(value);

    if (lastSent.current !== value) {
      lastSent.current = value;
      start.mutate(value);
    }
  };

  const checking = start.isPending || data?.checking === true;
  const status = start.isError ? WHATSAPP_STATUS.ERROR : data?.status;
  const settled = !checking && status !== undefined && status !== WHATSAPP_STATUS.UNKNOWN;
  const note = settled ? NOTE[status] : undefined;
  const label = checking
    ? ellipsis(t("whatsappCheck.checking"))
    : settled
      ? t(`whatsappCheck.${status}`)
      : undefined;

  const suffix =
    shown === null || label === undefined ? undefined : (
      <span
        role="img"
        aria-label={label}
        title={label}
        data-part="whatsapp-status"
        className={cn(
          "flex items-center justify-center",
          checking
            ? "text-success-700"
            : status === WHATSAPP_STATUS.AVAILABLE
              ? "text-social-whatsapp"
              : "text-ink-faint",
        )}
      >
        <Icon name="whatsapp" className={cn("size-4", checking && "animate-spin")} />
      </span>
    );

  return (
    <>
      <PhoneInput
        {...props}
        {...(testId !== undefined && { "data-testid": testId })}
        value={value}
        onBlur={onLeave}
        suffix={suffix}
      />
      {shown !== null && note !== undefined && (
        <p
          role="status"
          data-part="whatsapp-note"
          className="flex items-start gap-1.5 text-label text-warning-700"
        >
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          {t(note)}
        </p>
      )}
    </>
  );
}
