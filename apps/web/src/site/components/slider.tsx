import { Children, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { cx } from "@web/booking/ui";
import { SiteIcon } from "@web/site/components/site-icon";
import { useSite } from "@web/site/hooks/use-site";

export function Slider({
  children,
  label,
  item,
  "data-testid": testId,
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly item: string;
  readonly "data-testid": string;
}): JSX.Element {
  const { language, t } = useSite();
  const list = useRef<HTMLUListElement>(null);
  const items = Children.toArray(children);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const element = list.current;

    if (!element) {
      return;
    }

    const measure = (): void => setOverflows(element.scrollWidth > element.clientWidth + 1);
    const observer = new ResizeObserver(measure);

    observer.observe(element);
    measure();

    return () => observer.disconnect();
  }, [items.length]);

  const move = (direction: -1 | 1): void => {
    const element = list.current;
    const first = element?.firstElementChild;

    if (!element || !(first instanceof HTMLElement)) {
      return;
    }

    const step = first.offsetWidth + Number.parseFloat(getComputedStyle(element).columnGap || "0");
    const towardEnd = language === "ar" ? -1 : 1;

    element.scrollBy({ left: step * direction * towardEnd, behavior: "smooth" });
  };

  const arrow = (direction: -1 | 1): JSX.Element => (
    <button
      type="button"
      data-testid={`${testId}-${direction === 1 ? "next" : "previous"}`}
      aria-label={t(direction === 1 ? "carousel.next" : "carousel.previous")}
      aria-controls={`${testId}-list`}
      onClick={() => move(direction)}
      className={cx(
        "absolute top-1/2 z-10 hidden size-(--control-h) -translate-y-1/2 cursor-pointer items-center justify-center rounded-pill border border-line bg-surface text-primary-800 shadow-float hover:bg-primary-50 sm:inline-flex",
        direction === 1 ? "-end-3 lg:-end-5" : "-start-3 lg:-start-5",
      )}
    >
      <SiteIcon name={direction === 1 ? "chevron-end" : "chevron-start"} />
    </button>
  );

  return (
    <div data-testid={testId} className="relative">
      {overflows && arrow(-1)}
      <ul
        ref={list}
        id={`${testId}-list`}
        aria-label={label}
        data-reveal-group
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-1 pb-3 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((child, index) => (
          <li key={index} className={cx("min-w-0 shrink-0 snap-start", item)}>
            {child}
          </li>
        ))}
      </ul>
      {overflows && arrow(1)}
    </div>
  );
}
