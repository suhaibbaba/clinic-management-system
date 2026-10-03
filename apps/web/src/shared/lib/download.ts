export async function presentBlob(blob: Blob, filename: string, download: boolean): Promise<void> {
  const url = URL.createObjectURL(blob);

  if (download) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  } else {
    window.open(url, "_blank", "noopener");
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function printBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");

  frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0";
  frame.setAttribute("aria-hidden", "true");
  frame.src = url;

  await new Promise<void>((resolve) => {
    frame.addEventListener(
      "load",
      () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(url, "_blank", "noopener");
        }
        resolve();
      },
      { once: true },
    );
    document.body.appendChild(frame);
  });

  window.setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}
