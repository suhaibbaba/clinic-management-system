import { Badge, Button, Chip, Drawer, Input, Modal } from "@clinic/ui";
import { render } from "vitest-browser-react";
import { describe, expect, it } from "vitest";
import "@web/i18n";

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

    const shell = document.querySelector('[data-testid="name"]');
    const field = shell instanceof HTMLInputElement ? shell : shell?.querySelector("input");

    if (!(field instanceof HTMLInputElement)) {
      throw new Error("no input under the field's testid");
    }

    expect(field.getBoundingClientRect().width).toBeLessThanOrEqual(200);
  });
});
