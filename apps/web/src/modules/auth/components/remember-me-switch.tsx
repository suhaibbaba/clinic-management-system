import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@clinic/ui";

interface RememberMeSwitchProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}

export function RememberMeSwitch({ checked, onCheckedChange }: RememberMeSwitchProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Switch
      data-testid="login-remember-me"
      checked={checked}
      onCheckedChange={onCheckedChange}
      label={t("auth.rememberMe")}
    />
  );
}
