import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { DatePicker } from '@web/components/ui/date-picker';
import { Drawer } from '@web/components/ui/drawer';
import { Input } from '@web/components/ui/input';
import { Modal } from '@web/components/ui/modal';
import { TimePicker } from '@web/components/ui/time-picker';
import '@web/i18n';
import ar from '@web/i18n/locales/ar.json';

/**
 * What a dialog must not do when it opens.
 *
 * Radix focuses the first focusable element by default. In this app that first
 * element is very often a date or a time field, and the two failures compound:
 * a caret lands in a form nobody has touched, and the picker attached to that
 * field unfolds a calendar over the dialog before anyone has read its title.
 *
 * The fix is in the shared `Modal` and `Drawer`, so these tests are written
 * against those rather than against any one screen — a dialog somewhere in the
 * app cannot opt out of it, and a new one cannot forget.
 */

/** A dialog whose first field is a date picker: the worst case, on purpose. */
function DialogWithPickers({
  as = 'modal',
}: {
  readonly as?: 'modal' | 'drawer';
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');

  const body = (
    <>
      <DatePicker id="d" label="التاريخ" value={date} onChange={setDate} />
      <TimePicker id="t" label="الوقت" value={time} onChange={setTime} />
      <Input id="n" value={note} onChange={(event) => setNote(event.target.value)} />
    </>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        فتح
      </button>

      {as === 'modal' ? (
        <Modal open={open} onOpenChange={setOpen} title="common.save">
          {body}
        </Modal>
      ) : (
        <Drawer open={open} onOpenChange={setOpen} title="سجل" descriptionKey="common.save">
          {body}
        </Drawer>
      )}
    </>
  );
}

const openDialog = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'فتح' }));
  await screen.findByRole('dialog');
};

describe('a dialog that has just opened', () => {
  it('focuses no field, and unfolds no calendar', async () => {
    render(<DialogWithPickers />);
    await openDialog();

    // Nothing typable holds the caret. `document.body` is the other legal
    // answer; the dialog container itself is what our override focuses.
    const focused = document.activeElement;
    expect(focused?.tagName).not.toBe('INPUT');
    expect(focused?.tagName).not.toBe('TEXTAREA');

    // And the date field's popover is shut: `grid` is the calendar, and the
    // list of quarter hours is the time picker's.
    expect(screen.queryByRole('grid')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('button', { name: ar.common.today })).toBeNull();
  });

  it('still traps focus and still closes on Escape', async () => {
    render(<DialogWithPickers />);
    await openDialog();

    // The trap: focus is inside the dialog, not back on the page behind it.
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reaches the first field on the first Tab', async () => {
    render(<DialogWithPickers />);
    await openDialog();

    await userEvent.tab();

    // Not focused on open is not the same as unreachable: one Tab lands on the
    // date field exactly as it would on a page.
    expect(document.activeElement).toBe(screen.getAllByRole('textbox')[0]);
  });

  it('opens nothing when a picker merely receives focus', async () => {
    render(<DialogWithPickers />);
    await openDialog();

    // The root cause behind the bug above: focus is not intent. Only a click
    // on the button, or ArrowDown on the field, may open a picker.
    screen.getAllByRole('textbox')[0]?.focus();

    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('still opens the calendar from the field on ArrowDown', async () => {
    render(<DialogWithPickers />);
    await openDialog();

    const dateField = screen.getAllByRole('textbox')[0];
    dateField?.focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(await screen.findByRole('grid')).toBeInTheDocument();
  });

  it('applies to drawers too — the fix is in the shared components', async () => {
    render(<DialogWithPickers as="drawer" />);
    await openDialog();

    expect(document.activeElement?.tagName).not.toBe('INPUT');
    expect(screen.queryByRole('grid')).toBeNull();
  });
});
