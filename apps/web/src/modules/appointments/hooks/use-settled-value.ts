import { useEffect, useRef } from "react";

export function useSettledValue<T>(value: T, settling: boolean): T {
  const settled = useRef(value);

  useEffect(() => {
    if (!settling) {
      settled.current = value;
    }
  });

  return settling ? settled.current : value;
}
