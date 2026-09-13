# Vertical metrics: before and after

Arabic, RTL, captured against the development seed (`pnpm seed`) with the patients and lab-orders
screens. The chip pairs are magnified 6×, with a hairline drawn across the pill's exact vertical
centre; the selection pairs are the browser's own highlight over the same chip. Kept here so a pull
request can point at them rather than at a description of them.

| File                        | What it shows                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `01-money-chip-before.png`  | `1435 ₪` with the hairline crossing the bottom of the digits — they sit high       |
| `02-money-chip-after.png`   | The same chip with the hairline through the middle of the digits                   |
| `03-status-chip-before.png` | `متأخر` sitting high, the empty band under it as wide as the letters               |
| `04-status-chip-after.png`  | The same badge, letter band centred and the ra descender hanging into padding      |
| `05-selection-before.png`   | The selection over `1435 ₪`: dead space under the digits inside the highlight      |
| `06-selection-after.png`    | The same selection hugging the digits                                              |
| `07-paragraph-after.png`    | A vowelled Arabic paragraph at the body's 1.6 — spacing unchanged, nothing clipped |

They are not regression fixtures. The sweep that measures screens is `pnpm qa:screens`.
