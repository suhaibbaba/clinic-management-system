import { PHONE_COUNTRIES, type PhoneCountry } from "@shared/constants/phone";
import { useEffect, useId, useMemo, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { cx } from "@web/booking/ui";

const OPEN_KEYS = new Set(["Enter", " ", "ArrowDown"]);

export function CountryPicker({
  country,
  onChange,
  language,
  label,
  "data-testid": testId,
}: {
  readonly country: PhoneCountry;
  readonly onChange: (country: PhoneCountry) => void;
  readonly language: string;
  readonly label: string;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  const names = useMemo(() => new Intl.DisplayNames([language], { type: "region" }), [language]);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = PHONE_COUNTRIES.findIndex((entry) => entry.country === country);
  const [highlight, setHighlight] = useState(selectedIndex);

  useEffect(() => {
    if (!open) {
      return;
    }

    const outside = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", outside);
    list.current?.focus();

    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    if (open) {
      list.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, highlight]);

  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };

  const choose = (index: number): void => {
    const entry = PHONE_COUNTRIES[index];

    if (entry) {
      onChange(entry.country);
    }

    close();
  };

  const onListKey = (event: KeyboardEvent<HTMLUListElement>): void => {
    const last = PHONE_COUNTRIES.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, highlight + 1),
      ArrowUp: Math.max(0, highlight - 1),
      Home: 0,
      End: last,
    };

    if (event.key in moves) {
      event.preventDefault();
      setHighlight(moves[event.key] ?? highlight);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(highlight);
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close();
    }
  };

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-testid={testId}
        onClick={() => {
          setHighlight(selectedIndex);
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (!open && OPEN_KEYS.has(event.key)) {
            event.preventDefault();
            setHighlight(selectedIndex);
            setOpen(true);
          }
        }}
        className={cx(
          "inline-flex min-h-(--control-h) cursor-pointer items-center gap-1.5 rounded-control border-[1.5px] bg-sunken px-3",
          "text-field text-ink tabular-nums transition-colors duration-200",
          open
            ? "border-primary-600 shadow-field-focus"
            : "border-line-strong hover:border-neutral-400",
        )}
      >
        <bdi dir="ltr">{PHONE_COUNTRIES[selectedIndex]?.dial}</bdi>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cx(
            "size-4 text-ink-muted transition-transform duration-200",
            open && "rotate-180",
          )}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${highlight}`}
          dir={language === "ar" ? "rtl" : "ltr"}
          data-testid={testId && `${testId}-list`}
          onKeyDown={onListKey}
          className="booking-step absolute start-0 top-full z-50 mt-1.5 max-h-64 w-64 overflow-y-auto rounded-panel border border-line bg-surface p-1 shadow-float outline-none"
        >
          {PHONE_COUNTRIES.map((entry, index) => (
            <li
              key={entry.country}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              data-testid={testId && `${testId}-${entry.country}`}
              onPointerEnter={() => setHighlight(index)}
              onClick={() => choose(index)}
              className={cx(
                "flex min-h-(--control-h-sm) cursor-pointer items-center justify-between gap-4 rounded-control px-3 text-value transition-colors duration-150",
                index === highlight && "bg-primary-50",
                index === selectedIndex ? "font-medium text-primary-800" : "text-ink",
              )}
            >
              <span>{names.of(entry.country) ?? entry.country}</span>
              <bdi dir="ltr" className="text-label text-ink-muted tabular-nums">
                {entry.dial}
              </bdi>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
