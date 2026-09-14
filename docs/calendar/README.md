# The calendar, as it renders

Taken from the running app against the development seed (`pnpm seed`), Chromium at 1440 and 390,
in both languages. The "before" frames are the same screens on the previous commit. Kept here so a
pull request can point at them rather than at a description of them.

| File                                   | What it shows                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `01-today-selected-before.png`         | Today, selected: the number dark on the primary fill and effectively gone        |
| `02-today-selected-after.png`          | The same day: white on the fill, with the white dot that keeps "today"           |
| `03-today-unselected-after.png`        | Today, unselected: a primary outline and primary ink, no fill                    |
| `04-range-ar-before.png`               | A range in Arabic: the middle days light on their own tint, the end dark on blue |
| `05-range-ar-after.png`                | The same range: full-strength ink on the band, endpoints rounded on the outside  |
| `06-range-en-before.png`               | The same defect in English                                                       |
| `07-range-en-after.png`                | The mirrored rounding in English, and the arrows pointing the English way        |
| `08-trigger-value-ar-before.png`       | The range trigger in Arabic: the value pinned to the far left                    |
| `09-trigger-value-ar-after.png`        | The value at the inline start, digits still Latin inside their island            |
| `10-trigger-placeholder-ar-before.png` | The same, empty                                                                  |
| `11-trigger-placeholder-ar-after.png`  | The placeholder where the value will be                                          |
| `12-month-grid-ar.png`                 | The caption opens a month grid                                                   |
| `13-year-grid-1998-ar.png`             | 1998, three clicks from today, with the years outside the decade muted           |
| `14-dob-opens-on-years-phone-ar.png`   | A date of birth at 390px: it opens on the years, cells at the tap target         |
| `15-year-grid-phone-en.png`            | The same in English, with "next" disabled past next year                         |
| `16-chip-selection-money-ar.png`       | A money chip with its text selected: the highlight hugs the glyphs               |
| `17-chip-selection-status-ar.png`      | A status chip, the same band                                                     |
| `18-row-button-before-ar.png`          | A row button whose label wrapped and was clipped by its own fixed height         |
| `19-row-button-after-ar.png`           | The same button on one line                                                      |
| `20-disabled-submit-before-ar.png`     | A disabled submit at 40% opacity: white on pale blue, barely there               |
| `21-disabled-submit-after-ar.png`      | The same button as a solid muted pair                                            |
| `22-time-field-before-ar.png`          | A time field 87px wide: `14:00` rendered as `14…`                                |
| `23-time-field-after-ar.png`           | The same field on its own row                                                    |
| `24-day-grid-en.png`                   | The day grid in English                                                          |

They are not regression fixtures. The sweep that measures screens is `pnpm qa:screens`.
