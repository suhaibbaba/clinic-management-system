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
