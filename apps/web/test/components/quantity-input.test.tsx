import { cleanQuantity, QuantityInput } from "@clinic/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type JSX } from "react";
import { describe, expect, it } from "vitest";

function Host(): JSX.Element {
  const [value, setValue] = useState("");
  return (
    <QuantityInput
      aria-label="quantity"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe("a quantity field", () => {
  it("keeps whole numbers only: no letters, no decimal point", () => {
    expect(cleanQuantity("12abc")).toBe("12");
    expect(cleanQuantity("2.5")).toBe("25");
    expect(cleanQuantity("1,000")).toBe("1000");
  });

  it("reads an Arabic keypad's digits", () => {
    expect(cleanQuantity("١٢")).toBe("12");
  });

  it("drops letters as they are typed", async () => {
    render(<Host />);
    const field = screen.getByRole("textbox", { name: "quantity" });

    await userEvent.type(field, "1x0 boxes");

    expect(field).toHaveValue("10");
  });
});
