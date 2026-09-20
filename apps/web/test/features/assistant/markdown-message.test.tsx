import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownMessage } from "@web/features/assistant/markdown-message";

describe("An assistant answer", () => {
  it("draws a table the way the model wrote it", () => {
    render(
      <MarkdownMessage
        content={[
          "| المريض | الوقت |",
          "| --- | --- |",
          "| سمير عبد الله | 09:30 |",
          "| Lina Haddad | 10:00 |",
        ].join("\n")}
      />,
    );

    const rows = screen.getAllByRole("row");

    expect(rows).toHaveLength(3);
    expect(
      within(rows[0]!)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["المريض", "الوقت"]);
    expect(screen.getByRole("cell", { name: "سمير عبد الله" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Lina Haddad" })).toBeInTheDocument();
  });

  it("draws lists and bold, which is most of what an answer is", () => {
    render(<MarkdownMessage content={"**المجموع:** ٤٢\n\n- موعد أول\n- موعد تاني"} />);

    expect(screen.getByText("المجموع:").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "موعد أول",
      "موعد تاني",
    ]);
  });

  // The answer quotes text other people typed into patient records. A tag in there is a tag
  // somebody typed, not markup this page runs.
  it("prints HTML in the answer instead of rendering it", () => {
    const { container } = render(
      <MarkdownMessage
        content={'<img src="x" onerror="alert(1)"> and <script>alert(2)</script> stay text'}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("alert(1)");
  });

  // Mixed scripts are the normal case here: an Arabic answer quoting an English work type, or a
  // number. Each block resolves its own direction rather than inheriting the thread's.
  it("lets every block take its direction from its own text", () => {
    const { container } = render(
      <MarkdownMessage content={"الطلبية جاهزة\n\nZirconia crown, shade A2"} />,
    );

    const paragraphs = [...container.querySelectorAll("p")];

    expect(paragraphs).toHaveLength(2);
    for (const paragraph of paragraphs) {
      expect(paragraph.className).toContain("unicode-bidi:plaintext");
    }
  });

  it("keeps code left to right, whichever way the page runs", () => {
    const { container } = render(<MarkdownMessage content={"الكود `A2-3` للطلبية"} />);

    expect(container.querySelector("code")?.getAttribute("dir")).toBe("ltr");
  });

  it("opens a link in its own tab with no handle back on this page", () => {
    render(<MarkdownMessage content={"[التقرير](https://example.test/report)"} />);

    const link = screen.getByRole("link", { name: "التقرير" });

    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});
