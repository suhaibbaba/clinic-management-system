import { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FIELD_BUTTON } from '@ui/components/field';
import { Icon } from '@ui/components/icon';
import { Input, type InputProps } from '@ui/components/input';

export type PasswordInputProps = Omit<InputProps, 'type'>;

/**
 * A password field that can be read back. Typing one blind is how a wrong password gets typed
 * twice, and on a phone it is most of why people give up — so the reveal is part of the field
 * rather than something each screen bolts on.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ ...props }, ref) {
    const { t } = useTranslation();
    const [revealed, setRevealed] = useState(false);
    const disabled = props.disabled === true;

    return (
      <Input
        ref={ref}
        data-part="password-input"
        type={revealed ? 'text' : 'password'}
        {...props}
        // After the spread: a caller's `suffix` must not replace the only way to read the field.
        {...(!disabled && {
          suffix: (
            <button
              type="button"
              data-part="password-reveal"
              // Never submits the form it sits in, and never lands in the tab order between the
              // field and the button somebody is heading for.
              tabIndex={-1}
              aria-pressed={revealed}
              aria-label={t(revealed ? 'common.hidePassword' : 'common.showPassword')}
              title={t(revealed ? 'common.hidePassword' : 'common.showPassword')}
              onClick={() => setRevealed((shown) => !shown)}
              className={FIELD_BUTTON}
            >
              <Icon name={revealed ? 'eye-off' : 'eye'} className="size-4" />
            </button>
          ),
        })}
      />
    );
  },
);
