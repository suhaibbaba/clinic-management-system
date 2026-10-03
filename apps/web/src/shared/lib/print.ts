import { PAGE_MARK, TOTAL_MARK } from "@web/shared/constants/print";

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

const cssString = (text: string): string =>
  `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\A ")}"`;

const counterContent = (template: string): string =>
  template
    .split(PAGE_MARK)
    .map((part) => part.split(TOTAL_MARK).map(cssString).join(" counter(pages) "))
    .join(" counter(page) ");

export function printPageCss(marks: {
  readonly name: string;
  readonly title: string;
  readonly printed: string;
  readonly page: string;
}): string {
  return [
    "@page {",
    `  @top-right { content: ${cssString(marks.name)}; }`,
    `  @top-left { content: ${cssString(marks.title)}; }`,
    `  @bottom-right { content: ${cssString(`${marks.name}\n${marks.printed}`)}; }`,
    `  @bottom-left { content: ${counterContent(marks.page)}; }`,
    "}",
    "@page :first {",
    "  @top-right { content: none; }",
    "  @top-left { content: none; }",
    "}",
  ].join("\n");
}
