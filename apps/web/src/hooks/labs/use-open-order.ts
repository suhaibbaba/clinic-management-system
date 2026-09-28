import { useSearchParams } from "react-router-dom";

export function useOpenOrder(): (id: string) => void {
  const [, setParams] = useSearchParams();

  return (id) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        next.set("order", id);

        return next;
      },
      { replace: true },
    );
}
