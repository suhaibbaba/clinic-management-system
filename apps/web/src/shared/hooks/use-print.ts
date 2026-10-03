import { useEffect, useState } from "react";
import { sheetReady } from "@web/shared/lib/print";

export function usePrint(): { readonly printing: boolean; readonly print: () => void } {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) {
      return;
    }

    let cancelled = false;
    const done = (): void => setPrinting(false);

    window.addEventListener("afterprint", done);
    void sheetReady(document.querySelector(".print-root")).then(() => {
      if (!cancelled) {
        window.print();
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  return { printing, print: () => setPrinting(true) };
}
