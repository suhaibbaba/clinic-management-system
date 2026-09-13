# The control system, as it renders

Arabic, RTL, against the development seed (`pnpm seed`). The state gallery is the real components —
`Input`, `Select`, `SearchField`, `Textarea`, `DatePicker`, `Badge`, `Chip`, `Button` — rendered on a
throwaway route that is not part of the app; everything else is a screen of the app itself. Kept
here so a pull request can point at them rather than at a description of them.

| File                        | What it shows                                                                 |
| --------------------------- | ----------------------------------------------------------------------------- |
| `01-field-states.png`       | The six states side by side: rest, hover, focus, filled, disabled, error      |
| `02-filter-row.png`         | Search + select + two chips + action button, all `--control-h`, one baseline  |
| `03-disabled-long-390.png`  | A disabled select at 390px: the value ellipsises, the lock does not move      |
| `04-form.png`               | A full form — select, date picker, input, textarea, badges, both button sizes |
| `05-form-dark.png`          | The same form under `prefers-color-scheme: dark` — the app has one palette    |
| `06-labs-filter-before.png` | The labs filter row before: 44 / 36 / 36 / 34, four boxes and three heights   |
| `07-labs-filter-after.png`  | The same row after: 44 / 44 / 44 / 44                                         |
| `08-labs-screen.png`        | The whole labs screen on the new system                                       |

They are not regression fixtures. The sweep that measures screens is `pnpm qa:screens`.
