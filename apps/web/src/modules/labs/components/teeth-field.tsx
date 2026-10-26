import { useState, type JSX, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Icon, Input } from "@clinic/ui";
import { parseTeethInput } from "@web/shared/lib/teeth-input";

export function TeethField({
  id,
  value,
  onChange,
  single = false,
}: {
  readonly id: string;
  readonly value: readonly number[];
  readonly onChange: (teeth: number[]) => void;
  readonly single?: boolean | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  const add = (raw: string): void => {
    const parsed = parseTeethInput(raw);

    if (parsed === null || (single && parsed.length > 1)) {
      setInvalid(raw.trim() !== "");
      return;
    }

    setInvalid(false);
    setDraft("");

    if (single) {
      onChange(parsed);
    } else {
      onChange([...new Set([...value, ...parsed])].sort((a, b) => a - b));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter" || event.key === "," || event.key === " ") {
      event.preventDefault();
      add(draft);
      return;
    }

    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div data-testid="teeth-field" className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul data-testid="teeth-field-list" className="flex flex-wrap gap-1.5">
          {value.map((tooth) => (
            <li key={tooth} data-testid={`teeth-field-tooth-${tooth}`}>
              <span
                dir="ltr"
                className="pill-text inline-flex items-center h-(--control-h-sm) gap-2 rounded-pill bg-inset pe-1.5 ps-3 text-label font-medium tabular-nums text-ink"
              >
                {tooth}
                <button
                  type="button"
                  data-testid={`teeth-field-remove-${tooth}`}
                  aria-label={t("labs.order.removeTooth", { tooth })}
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
        data-testid="teeth-field-input"
        dir="ltr"
        inputMode="tel"
        placeholder="46"
        value={draft}
        hasError={invalid}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => draft !== "" && add(draft)}
      />

      <p
        data-testid="teeth-field-hint"
        className={invalid ? "text-label text-danger-600" : "text-label text-ink-muted"}
      >
        {t(invalid ? "labs.order.toothInvalid" : "labs.order.toothHint")}
      </p>
    </div>
  );
}
