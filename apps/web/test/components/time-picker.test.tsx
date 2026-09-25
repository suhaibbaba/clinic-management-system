import { TimePicker, to12Hour } from "@clinic/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import "@web/i18n";
import ar from "@web/i18n/locales/ar.json";

function Host({ initial }: { initial: string }): React.JSX.Element {
  const [value, setValue] = useState(initial);

  return (
    <>
      <TimePicker id="at" label="at" value={value} onChange={setValue} />
      <output data-testid="stored">{value}</output>
    </>
  );
}

describe("TimePicker", () => {
  it("shows a stored time with AM or PM", () => {
    expect(["00:00", "09:05", "12:00", "12:30", "21:45"].map(to12Hour)).toEqual([
      "12:00 AM",
      "9:05 AM",
      "12:00 PM",
      "12:30 PM",
      "9:45 PM",
    ]);
  });

  it("is picked from the list, never typed, and stores HH:mm", async () => {
    render(<Host initial="14:00" />);

    expect(screen.queryByRole("textbox")).toBeNull();

    const field = screen.getByRole("button", { name: /2:00 PM/ });
    await userEvent.click(field);
    await userEvent.click(screen.getByRole("button", { name: "9:30 PM" }));

    expect(screen.getByTestId("stored")).toHaveTextContent("21:30");
    expect(field).toHaveTextContent("9:30 PM");
  });

  it("opens from the keyboard with ArrowDown", async () => {
    render(<Host initial="" />);

    screen.getByRole("button", { name: ar.common.placeholders.time }).focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: "12:00 AM" })).toBeInTheDocument();
  });
});
