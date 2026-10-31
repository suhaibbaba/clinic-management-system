import { isCheckablePhone, WHATSAPP_STATUS, type WhatsAppStatus } from "@clinic/shared";
import { Icon, PhoneInput, type IconName, type PhoneInputProps } from "@clinic/ui";
import { useRef, useState, type FocusEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { ellipsis } from "@web/i18n/ellipsis";
import { cn } from "@clinic/ui/lib/cn";
import { useStartWhatsAppCheck, useWhatsAppCheck } from "@web/shared/queries/whatsapp-checks";

const LOOK: Readonly<Record<Exclude<WhatsAppStatus, "unknown">, { icon: IconName; tone: string }>> =
  {
    [WHATSAPP_STATUS.AVAILABLE]: { icon: "whatsapp", tone: "text-success-700" },
    [WHATSAPP_STATUS.UNAVAILABLE]: { icon: "x", tone: "text-danger-700" },
    [WHATSAPP_STATUS.ERROR]: { icon: "alert", tone: "text-warning-700" },
  };

export interface WhatsAppPhoneInputProps extends PhoneInputProps {
  readonly check: boolean;
}

export function WhatsAppPhoneInput({
  check,
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
  const shown = check && subject !== null && subject === value ? subject : null;
  const { data } = useWhatsAppCheck(shown);

  const onLeave = (event: FocusEvent<HTMLInputElement>): void => {
    onBlur?.(event);

    if (!check || !isCheckablePhone(value)) {
      return;
    }

    setSubject(value);

    if (lastSent.current !== value) {
      lastSent.current = value;
      start.mutate(value);
    }
  };

  const checking = start.isPending || data?.checking === true;
  const look = data && data.status !== WHATSAPP_STATUS.UNKNOWN ? LOOK[data.status] : null;

  const suffix =
    shown === null ? undefined : checking ? (
      <span className="inline-flex items-center gap-1.5 text-ink-muted">
        <Icon name="spinner" className="size-4 animate-spin" />
        {ellipsis(t("whatsappCheck.checking"))}
      </span>
    ) : look ? (
      <span className={cn("inline-flex items-center gap-1.5", look.tone)}>
        <Icon name={look.icon} className="size-4" />
        {t(`whatsappCheck.${data?.status ?? WHATSAPP_STATUS.ERROR}`)}
      </span>
    ) : undefined;

  return (
    <PhoneInput
      {...props}
      {...(testId !== undefined && { "data-testid": testId })}
      value={value}
      onBlur={onLeave}
      suffix={suffix}
    />
  );
}
