import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

export async function choose(field: HTMLElement, label: string | RegExp): Promise<void> {
  await userEvent.click(field);
  await userEvent.click(await screen.findByRole("option", { name: label }));
}
