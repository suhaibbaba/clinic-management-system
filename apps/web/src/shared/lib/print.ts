const IMAGE_WAIT_MS = 3000;

const loaded = (image: HTMLImageElement): Promise<void> =>
  image.complete
    ? Promise.resolve()
    : new Promise((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });

export async function sheetReady(root: ParentNode | null): Promise<void> {
  const images = [...(root?.querySelectorAll("img") ?? [])];
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, IMAGE_WAIT_MS));

  await Promise.race([Promise.all(images.map(loaded)), timeout]);
}
