import { useLayoutEffect, useState, type RefObject } from "react";

export function useMeasuredHeight(target: RefObject<HTMLElement | null>): number | undefined {
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const element = target.current;

    if (!element) {
      return;
    }

    const measure = (): void => setHeight(element.offsetHeight);

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(element);

    return () => observer.disconnect();
  }, [target]);

  return height;
}
