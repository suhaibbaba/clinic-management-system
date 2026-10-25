import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

interface ThumbBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface SegmentThumb {
  readonly style: CSSProperties | undefined;
  readonly animate: boolean;
}

export function useSegmentThumb(
  container: RefObject<HTMLElement | null>,
  selector: string,
  active: string | undefined,
): SegmentThumb {
  const [box, setBox] = useState<ThumbBox>();
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const root = container.current;

    if (!root) {
      return;
    }

    const measure = (): void => {
      const target = root.querySelector<HTMLElement>(selector);

      setBox(
        target
          ? {
              left: target.offsetLeft,
              top: target.offsetTop,
              width: target.offsetWidth,
              height: target.offsetHeight,
            }
          : undefined,
      );
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(root);
    for (const child of Array.from(root.children)) {
      observer.observe(child);
    }

    return () => observer.disconnect();
  }, [container, selector, active]);

  useEffect(() => {
    if (!box || animate) {
      return;
    }

    const frame = requestAnimationFrame(() => setAnimate(true));

    return () => cancelAnimationFrame(frame);
  }, [box, animate]);

  return {
    style: box && {
      width: box.width,
      height: box.height,
      transform: `translate(${box.left}px, ${box.top}px)`,
    },
    animate,
  };
}
