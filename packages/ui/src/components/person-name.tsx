import { bothNames, personName, type PersonName as Name } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface PersonNameProps extends TestIdProps {
  readonly name: Name | null | undefined;
  readonly className?: string | undefined;
  readonly fallback?: string | undefined;
  readonly showBoth?: boolean | undefined;
}

export function PersonName({
  name,
  className,
  fallback = "—",
  showBoth = false,
  "data-testid": testId,
}: PersonNameProps): JSX.Element {
  const { i18n } = useTranslation();
  const resolved = personName(name, i18n.language);

  return (
    <span
      data-part="person-name"
      {...testid(testId)}
      className={className}
      {...(showBoth && name && resolved !== "" && { title: bothNames(name) })}
    >
      {resolved === "" ? fallback : resolved}
    </span>
  );
}

export function usePersonName(): (name: Name | null | undefined) => string {
  const { i18n } = useTranslation();

  return (name) => personName(name, i18n.language);
}
