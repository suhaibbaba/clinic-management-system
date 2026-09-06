import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OtpStep } from '@web/booking/steps/otp-step';

function renderStep(overrides: Partial<Parameters<typeof OtpStep>[0]> = {}) {
  const onVerify = vi.fn();
  const onResend = vi.fn();

  render(
    <OtpStep
      phone="0931234567"
      busy={false}
      error={undefined}
      attemptsLeft={3}
      onVerify={onVerify}
      onResend={onResend}
      {...overrides}
    />,
  );

  return {
    onVerify,
    onResend,
    boxes: () => screen.getAllByRole('textbox', { name: /الرقم/ }) as HTMLInputElement[],
  };
}

const type = async (
  user: ReturnType<typeof userEvent.setup>,
  boxes: HTMLInputElement[],
  code: string,
): Promise<void> => {
  for (const [index, digit] of [...code].entries()) {
    await user.type(boxes[index] as HTMLElement, digit);
  }
};

/**
 * The six boxes.
 *
 * Everything here is a thing a person actually does with an SMS code on a
 * phone: they paste it, they mistype and back up, they finish it. Each one was
 * a bug at some point in a six-box input somewhere — the auto-submit in
 * particular shipped broken (`'123456'.includes('')` is `true`, so the guard
 * that was meant to check for gaps never let anything through) and this is the
 * test that caught it.
 */
describe('OTP input', () => {
  it('starts with the keyboard in the first box', () => {
    const { boxes } = renderStep();

    expect(boxes()[0]).toHaveFocus();
  });

  it('moves forward as digits are typed, and submits on the sixth', async () => {
    const user = userEvent.setup();
    const { boxes, onVerify } = renderStep();

    await type(user, boxes(), '123456');

    expect(boxes().map((box) => box.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(onVerify).toHaveBeenCalledExactlyOnceWith('123456');
  });

  it('fills every box from a paste into any one of them', async () => {
    const user = userEvent.setup();
    const { boxes, onVerify } = renderStep();

    await user.click(boxes()[0] as HTMLElement);
    await user.paste('987654');

    expect(boxes().map((box) => box.value)).toEqual(['9', '8', '7', '6', '5', '4']);
    expect(onVerify).toHaveBeenCalledExactlyOnceWith('987654');
  });

  it('ignores the spaces and dashes an SMS puts around a code', async () => {
    const user = userEvent.setup();
    const { boxes, onVerify } = renderStep();

    await user.click(boxes()[0] as HTMLElement);
    await user.paste('12 34-56');

    expect(onVerify).toHaveBeenCalledExactlyOnceWith('123456');
  });

  it('steps back on backspace, clearing the box it lands in', async () => {
    const user = userEvent.setup();
    const { boxes } = renderStep();

    await type(user, boxes(), '12');
    // Focus is in the third box, which is empty: backspace should go back
    // rather than do nothing, which is what makes correcting a typo one key.
    await user.keyboard('{Backspace}');

    expect(boxes()[1]).toHaveFocus();
    expect(boxes()[1]?.value).toBe('');
  });

  it('holds the resend behind a countdown', async () => {
    const { onResend } = renderStep();

    expect(screen.getByText(/يمكنك إعادة الإرسال بعد/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'إعادة إرسال الرمز' })).not.toBeInTheDocument();
    expect(onResend).not.toHaveBeenCalled();
  });

  it('shows the failure it was given, as an announced message', () => {
    renderStep({ error: 'الرمز غير صحيح. تبقّى لديك 2 محاولة.' });

    expect(screen.getByRole('status')).toHaveTextContent('تبقّى لديك 2');
  });
});
