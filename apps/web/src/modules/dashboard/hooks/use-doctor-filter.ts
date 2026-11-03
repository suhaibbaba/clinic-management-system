import { useSearchParams } from "react-router-dom";

export function useDoctorFilter(): readonly [string | null, (id: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("doctor");

  const set = (id: string | null): void => {
    const next = new URLSearchParams(params);

    if (id === null) {
      next.delete("doctor");
    } else {
      next.set("doctor", id);
    }

    setParams(next, { replace: true });
  };

  return [raw, set];
}
