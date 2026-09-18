import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { FIELD_BUTTON } from "@ui/components/field";
import { Icon } from "@ui/components/icon";
import { Input, type InputProps } from "@ui/components/input";
import { testid } from "@ui/lib/testid";

export type PasswordInputProps = Omit<InputProps, "type">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ "data-testid": testId, ...props }, ref) {
    const { t } = useTranslation();
    const [revealed, setRevealed] = useState(false);
    const disabled = props.disabled === true;

    return (
      <Input
        ref={ref}
        data-part="password-input"
        {...testid(testId)}
        type={revealed ? "text" : "password"}
        {...props}
        // After the spread: a caller's `suffix` must not replace the only way to read the field.
        {...(!disabled && {
          suffix: (
            <button
              type="button"
              data-part="password-reveal"
              {...testid(testId, "reveal")}
              // Never submits the form it sits in, and never lands in the tab order between the
              // field and the button somebody is heading for.
              tabIndex={-1}
              aria-pressed={revealed}
              aria-label={t(revealed ? "common.hidePassword" : "common.showPassword")}
              title={t(revealed ? "common.hidePassword" : "common.showPassword")}
              onClick={() => setRevealed((shown) => !shown)}
              className={FIELD_BUTTON}
            >
              <Icon name={revealed ? "eye-off" : "eye"} className="size-4" />
            </button>
          ),
        })}
      />
    );
  },
);
