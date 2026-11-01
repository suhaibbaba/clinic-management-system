import { act } from "@testing-library/react";
import { vi } from "vitest";

export function holdConfirmClock(): void {
  vi.useFakeTimers({ shouldAdvanceTime: true });
}

export async function passConfirmHold(): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(5000));
}
