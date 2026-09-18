import type { PersonName } from "@clinic/shared";
import type { JSX } from "react";

import { Img } from "@clinic/ui/components/img";
import { usePersonName } from "@clinic/ui/components/person-name";
import { cn } from "@clinic/ui/lib/cn";

export type LogoSize = "chrome" | "print" | "login";

// Fixed boxes, because the rail and the sign-in card must not resize around a clinic's own
// artwork. `contain` fits a wide wordmark and a square badge alike.
const SIZES: Record<LogoSize, { readonly width: number; readonly height: number }> = {
  chrome: { width: 212, height: 56 },
  print: { width: 160, height: 60 },
  login: { width: 200, height: 80 },
};

export interface LogoProps {
  size?: LogoSize | undefined;
  "data-testid"?: string | undefined;
  /** The clinic's own uploaded logo. There is no bundled one — see `InitialMark`. */
  src?: string | null | undefined;
  /** Supplies the letter the mark falls back to. */
  name?: PersonName | null | undefined;
  className?: string | undefined;
  alt?: string | undefined;
}

export function Logo({
  size = "print",
  src,
  name,
  className,
  alt,
  "data-testid": testId = "logo",
}: LogoProps): JSX.Element {
  const resolve = usePersonName();
  const { width, height } = SIZES[size];

  return (
    <Img
      data-testid={testId}
      src={src}
      alt={alt ?? ""}
      width={width}
      height={height}
      fit="contain"
      priority
      className={cn("mx-auto", className)}
      fallback={<InitialMark letter={firstLetter(resolve(name))} size={height} />}
    />
  );
}

export function InitialMark({
  letter,
  size,
}: {
  readonly letter: string;
  readonly size: number;
}): JSX.Element {
  return (
    <span
      data-testid="logo-initial"
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center"
    >
      <span
        // The generated mark's initial is a fraction of its own box, which no fixed size can name.
        // check-type-disable-next-line
        style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
        className={cn(
          "flex items-center justify-center rounded-card",
          "bg-primary-100 font-medium text-primary-800 select-none",
        )}
      >
        {letter}
      </span>
    </span>
  );
}

const firstLetter = (name: string): string => [...name.trim()][0] ?? "";
