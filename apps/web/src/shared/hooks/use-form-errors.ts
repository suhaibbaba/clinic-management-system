import { useCallback, useRef, useState, type FocusEvent, type RefObject } from "react";
import { revealFirstError, shownErrors, type FieldErrors } from "@web/shared/lib/form-errors";

export interface FormErrorsApi<TRoot extends HTMLElement> {
  readonly errors: FieldErrors;
  readonly isValid: boolean;
  readonly formRef: RefObject<TRoot | null>;
  readonly leave: (field: string) => (event: FocusEvent<HTMLElement>) => void;
  readonly check: () => boolean;
  readonly reset: () => void;
}

export function useFormErrors<TRoot extends HTMLElement = HTMLDivElement>(
  all: FieldErrors,
): FormErrorsApi<TRoot> {
  const [left, setLeft] = useState<readonly string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<TRoot | null>(null);

  const leave = useCallback(
    (field: string) => (event: FocusEvent<HTMLElement>) => {
      if (stillInside(event)) {
        return;
      }

      setLeft((current) => (current.includes(field) ? current : [...current, field]));
    },
    [],
  );

  const check = (): boolean => {
    setSubmitted(true);

    if (Object.keys(all).length === 0) {
      return true;
    }

    revealFirstError(formRef.current);

    return false;
  };

  const reset = useCallback(() => {
    setLeft([]);
    setSubmitted(false);
  }, []);

  return {
    errors: submitted ? all : shownErrors(all, left),
    isValid: Object.keys(all).length === 0,
    formRef,
    leave,
    check,
    reset,
  };
}

function stillInside(event: FocusEvent<HTMLElement>): boolean {
  const next = event.relatedTarget;

  if (!(next instanceof Node)) {
    return false;
  }

  return (
    event.currentTarget.contains(next) ||
    (next instanceof Element && next.closest("[data-radix-popper-content-wrapper]") !== null)
  );
}
