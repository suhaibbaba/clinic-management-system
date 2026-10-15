import { Children, useRef, useState, type JSX, type ReactNode } from "react";
import { cx } from "@web/booking/ui";
import { Dots } from "@web/site/components/dots";
import { useSite } from "@web/site/hooks/use-site";

export function Carousel({
  children,
  grid,
  label,
  "data-testid": testId,
}: {
  readonly children: ReactNode;
  readonly grid: string;
  readonly label: string;
  readonly "data-testid"?: string;
}): JSX.Element {
  const { t } = useSite();
  const list = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const items = Children.toArray(children);

  const track = (): void => {
    const element = list.current;
    const first = element?.firstElementChild;

    if (!element || !(first instanceof HTMLElement)) {
      return;
    }

    const step = first.offsetWidth + Number.parseFloat(getComputedStyle(element).columnGap || "0");

    setActive(Math.min(items.length - 1, Math.round(Math.abs(element.scrollLeft) / step)));
  };

  const show = (index: number): void => {
    const target = list.current?.children[index];

    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  return (
    <div data-testid={testId} className="flex flex-col gap-4">
      <ul
        ref={list}
        data-reveal-group
        aria-label={label}
        onScroll={track}
        className={cx(
          "relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-1 pb-3 [scrollbar-width:none] sm:mx-0 [&::-webkit-scrollbar]:hidden sm:overflow-visible sm:p-0",
          grid,
        )}
      >
        {items.map((item, index) => (
          <li
            key={index}
            className="relative w-[80%] max-w-80 min-w-0 shrink-0 snap-center sm:w-auto sm:max-w-none"
          >
            {item}
          </li>
        ))}
      </ul>
      <Dots
        count={items.length}
        active={active}
        onSelect={show}
        label={label}
        itemLabel={(index) => t("carousel.item", { number: index + 1, total: items.length })}
        className="justify-center sm:hidden"
        {...(testId && { "data-testid": `${testId}-dots` })}
      />
    </div>
  );
}
