import { isFdiTooth } from '@clinic/shared';
import { useState, type JSX, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon, Input } from '@web/components/ui';

// Chips rather than free text, so "1 4" and "١٤" are refused as they are typed instead of the API
// rejecting the lot with one message. Numbers are an LTR island.
export function TeethField({
  id,
  value,
  onChange,
}: {
  readonly id: string;
  readonly value: readonly number[];
  readonly onChange: (teeth: number[]) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);

  const add = (raw: string): void => {
    const parsed = Number(raw.trim());

    if (!Number.isInteger(parsed) || !isFdiTooth(parsed)) {
      setInvalid(raw.trim() !== '');
      return;
    }

    setInvalid(false);
    setDraft('');

    if (!value.includes(parsed)) {
      onChange([...value, parsed].sort((a, b) => a - b));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      event.preventDefault();
      add(draft);
      return;
    }

    // Backspace on an empty box removes the last chip — what every tag input does.
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tooth) => (
            <li key={tooth}>
              <span
                dir="ltr"
                className="inline-flex items-center gap-1 rounded-pill bg-inset py-1 pe-1 ps-2.5 text-label font-medium tabular-nums text-ink"
              >
                {tooth}
                <button
                  type="button"
                  aria-label={t('labs.order.removeTooth', { tooth })}
                  onClick={() => onChange(value.filter((item) => item !== tooth))}
                  className="cursor-pointer rounded-pill p-0.5 text-ink-subtle transition-colors duration-150 hover:text-ink"
                >
                  <Icon name="x" className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Input
        id={id}
        dir="ltr"
        inputMode="numeric"
        placeholder="46"
        value={draft}
        hasError={invalid}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => draft !== '' && add(draft)}
      />

      <p className={invalid ? 'text-label text-danger-600' : 'text-label text-ink-muted'}>
        {t(invalid ? 'labs.order.toothInvalid' : 'labs.order.toothHint')}
      </p>
    </div>
  );
}
