import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from '@web/components/ui/badge';

const SRC = join(__dirname, '..', '..');

const readSrc = (...parts: string[]): string => readFileSync(join(SRC, ...parts), 'utf8');

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sources(path);
    }

    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : [];
  });
}

const withoutComments = (source: string): string =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/.*/g, '');

/** Every `className=…` value in a file, braces and nesting followed to the end of the expression. */
function classNameValues(source: string): string[] {
  const values: string[] = [];

  for (const match of source.matchAll(/className=/g)) {
    let index = (match.index ?? 0) + match[0].length;

    const quote = source[index];

    if (quote === '"' || quote === "'") {
      const end = source.indexOf(quote, index + 1);
      values.push(source.slice(index + 1, end));
      continue;
    }

    let depth = 0;
    const start = index;

    for (; index < source.length; index += 1) {
      const character = source[index];

      if (character === '{' || character === '(') {
        depth += 1;
      } else if (character === '}' || character === ')') {
        depth -= 1;

        if (depth === 0) {
          break;
        }
      }
    }

    values.push(source.slice(start, index));
  }

  return values;
}

// The badge is the shape every other pill copies, so it is the one asserted by name: `pill-text`
// carries the box, and nothing in the component declares a line-height of its own.
describe('the badge draws its line box from the shared pill class', () => {
  it('renders with it', () => {
    render(<Badge tone="danger">مؤكَّد</Badge>);

    expect(screen.getByText('مؤكَّد')).toHaveClass('pill-text');
  });

  it('never sets a line-height of its own', () => {
    expect(readSrc('components', 'ui', 'badge.tsx')).not.toMatch(/leading-/);
  });

  it('is inline-flex, centred, and one em tall', () => {
    const base = readSrc('base.css');
    const utility = base.slice(base.indexOf('.pill-text {'));
    const body = utility.slice(0, utility.indexOf('}') + 1);

    expect(body).toContain('display: inline-flex;');
    expect(body).toContain('align-items: center;');
    expect(body).toContain('line-height: 1;');
    // Free where the browser has it; the overridden metrics centre the same band where it does not.
    expect(body).toContain('text-box-trim: trim-both;');
    expect(body).toContain('text-box-edge: cap alphabetic;');
  });
});

// The overrides are the fix; a weight added without them would bring the old box back on that
// weight alone, which reads as one bold chip sitting differently from the rest.
describe('every Tajawal face carries the metric overrides', () => {
  it('overrides ascent, descent and line gap on all of them', () => {
    const faces = readSrc('fonts.css')
      .split('@font-face')
      .slice(1)
      .filter((face) => face.includes("font-family: 'Tajawal'"));

    expect(faces).toHaveLength(6);

    for (const face of faces) {
      expect(face).toContain('ascent-override: 78%;');
      expect(face).toContain('descent-override: 22%;');
      expect(face).toContain('line-gap-override: 0%;');
    }
  });
});

// The whole point of fixing the metrics is that no screen needs to shove its own text about. A
// nudge that comes back is a nudge that hides the next regression in the box.
describe('no pill nudges its own text', () => {
  const PILL = /\b(?:pill-text|rounded-pill|rounded-chip)\b/;

  /** Vertical shoves: a transform, a negative or arbitrary block margin, a baseline offset. */
  const NUDGE =
    /-?translate-y-|vertical-align|(?<![\w-])-m[tb]-|(?<![\w-])m[tb]-\[-|(?<![\w-])-?top-\[/;

  it('leaves no translate or margin hack on text inside one', () => {
    const offenders = sources(SRC).flatMap((path) =>
      classNameValues(withoutComments(readFileSync(path, 'utf8')))
        .filter((value) => PILL.test(value) && NUDGE.test(value))
        .map((value) => `${path.split('/').at(-1) ?? ''}: ${value.replaceAll(/\s+/g, ' ')}`),
    );

    expect(offenders).toEqual([]);
  });

  it('never reaches for vertical-align anywhere', () => {
    const offenders = sources(SRC).filter((path) =>
      withoutComments(readFileSync(path, 'utf8')).includes('vertical-align'),
    );

    expect(offenders).toEqual([]);
  });
});
