import {
  Children,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
} from "react";
import { cx } from "@web/booking/ui";

export function Marquee({
  children,
  label,
  item,
  secondsPerItem = 4,
  "data-testid": testId,
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly item: string;
  readonly secondsPerItem?: number;
  readonly "data-testid": string;
}): JSX.Element {
  const frame = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const echo = useRef<HTMLUListElement>(null);
  const items = Children.toArray(children);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    const outer = frame.current;
    const inner = list.current;

    if (!outer || !inner) {
      return;
    }

    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const measure = (): void =>
      setMoving(!still.matches && inner.scrollWidth > outer.clientWidth + 1);
    const observer = new ResizeObserver(measure);

    observer.observe(outer);
    observer.observe(inner);
    still.addEventListener("change", measure);
    measure();

    return () => {
      observer.disconnect();
      still.removeEventListener("change", measure);
    };
  }, [items.length]);

  useEffect(() => {
    echo.current?.querySelectorAll<HTMLElement>("a, button").forEach((target) => {
      target.tabIndex = -1;
    });
  }, [moving, items.length]);

  const copy = (hidden: boolean): JSX.Element => (
    <ul
      {...(hidden ? { ref: echo, "aria-hidden": true } : { ref: list, "aria-label": label })}
      className={cx("flex shrink-0 gap-4", moving && "pe-4")}
    >
      {items.map((child, index) => (
        <li key={index} className={cx("min-w-0 shrink-0", item)}>
          {child}
        </li>
      ))}
    </ul>
  );

  return (
    <div
      ref={frame}
      data-testid={testId}
      data-moving={moving}
      className={cx(
        "-mx-4 -mb-9 px-4 pt-1 pb-12 sm:mx-0 sm:px-0",
        moving
          ? "site-marquee-mask overflow-hidden"
          : "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
      <div
        className={cx("flex w-max", moving ? "site-marquee" : "mx-auto")}
        style={{ "--marquee-duration": `${items.length * secondsPerItem}s` } as CSSProperties}
      >
        {copy(false)}
        {moving && copy(true)}
      </div>
    </div>
  );
}
