import { Badge, Button, Chip, Drawer, Input, Modal } from "@clinic/ui";
import { render } from "vitest-browser-react";
import { describe, expect, it } from "vitest";
import "@web/i18n";

// The rules in CLAUDE.md that are about pixels rather than markup. jsdom lays nothing out and
// resolves no custom property, so none of this can be asserted in the other project.
const token = (name: string): number =>
  Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));

const box = (testId: string): DOMRect => {
  const element = document.querySelector(`[data-testid="${testId}"]`);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`nothing carries data-testid="${testId}"`);
  }

  return element.getBoundingClientRect();
};

describe("a control is one of the two heights, never a third", () => {
  // A chip is pressed and a badge is read, so they are not the same height: the chip is a target
  // and takes the full one, the badge is a label and takes the compact one.
  it("gives a chip the target height and a badge the compact one", async () => {
    await render(
      <>
        <Chip data-testid="chip">متأخر</Chip>
        <Badge data-testid="badge">أرسل</Badge>
      </>,
    );

    expect(box("chip").height).toBe(token("--control-h"));
    expect(box("badge").height).toBe(token("--control-h-sm"));
  });

  it("keeps a button on the scale whichever size it is asked for", async () => {
    await render(
      <>
        <Button data-testid="md">حفظ</Button>
        <Button size="sm" data-testid="sm">
          حفظ
        </Button>
      </>,
    );

    // `sm` is the tall one below `lg` — a thumb does not shrink with the viewport — so both are
    // on the scale, and neither is a value of its own.
    expect([token("--control-h"), token("--control-h-sm")]).toContain(box("md").height);
    expect([token("--control-h"), token("--control-h-sm")]).toContain(box("sm").height);
  });
});

describe("direction is a property of the page, not of a rule per component", () => {
  it("puts a drawer's close button at the inline end, which in Arabic is the left", async () => {
    await render(
      <Drawer
        open
        onOpenChange={() => {}}
        title="تاج زيركون"
        descriptionKey="common.close"
        data-testid="drawer"
      >
        <p>محتوى</p>
      </Drawer>,
    );

    const footer = box("drawer-footer");
    const close = box("drawer-footer-close");

    expect(document.documentElement.dir).toBe("rtl");
    // Hard against the footer's left edge, and nowhere near its right.
    expect(close.left - footer.left).toBeLessThan(24);
    expect(footer.right - close.right).toBeGreaterThan(24);
  });
});

describe("a dialog opens to be read", () => {
  it("focuses nothing, so no caret lands in an untouched form", async () => {
    await render(
      <Modal open onOpenChange={() => {}} title="common.close" data-testid="dialog">
        <Input data-testid="first-field" aria-label="الاسم" />
      </Modal>,
    );

    const field = document.querySelector('[data-testid="first-field"]');

    expect(document.activeElement).not.toBe(field);
    expect(document.activeElement?.tagName).not.toBe("INPUT");
  });
});

describe("a value that outgrows its box truncates rather than escaping it", () => {
  it("keeps a long Arabic name inside the field that holds it", async () => {
    await render(
      <div style={{ width: "200px" }}>
        <Input
          data-testid="name"
          aria-label="الاسم"
          readOnly
          value="إبراهيم عبد الرحمن محمد الحاج سعيد الطويل جدًا"
        />
      </div>,
    );

    // The testid names the shell the value sits in, not the input itself.
    const shell = document.querySelector('[data-testid="name"]');
    const field = shell instanceof HTMLInputElement ? shell : shell?.querySelector("input");

    if (!(field instanceof HTMLInputElement)) {
      throw new Error("no input under the field's testid");
    }

    // The text overflows its own scroll width, which is what an input does — what matters is that
    // the box it sits in never grows past the 200px it was given.
    expect(field.getBoundingClientRect().width).toBeLessThanOrEqual(200);
  });
});
