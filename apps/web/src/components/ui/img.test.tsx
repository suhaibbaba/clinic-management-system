import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Img } from '@web/components/ui/img';

/** The reserved box — everything that must not change as the file loads, fails or arrives. */
const box = (container: HTMLElement): Record<string, string> => {
  const { style } = container.firstElementChild as HTMLElement;

  return {
    width: style.width,
    height: style.height,
    aspectRatio: style.aspectRatio,
  };
};

const SRC = 'https://storage.example/signed/xray.png';

describe('Img sizing', () => {
  it('derives a fluid box from its ratio and nothing else', () => {
    const { container } = render(<Img src={SRC} alt="أشعة" aspectRatio="4/3" />);

    // No height: the column decides the width and the ratio decides the rest, which is what lets
    // the same tile hold its shape as its grid resizes.
    expect(box(container)).toEqual({ width: '', height: '', aspectRatio: '4/3' });
  });

  it('pins a fixed box to its two numbers', () => {
    const { container } = render(<Img src={SRC} alt="صورة" width={64} height={64} />);

    expect(box(container)).toEqual({ width: '64px', height: '64px', aspectRatio: '' });
  });

  it('holds the same box while loading, once loaded and after an error', () => {
    const { container } = render(<Img src={SRC} alt="أشعة" aspectRatio="1/1" />);
    const loading = box(container);

    expect(container.querySelector('.skeleton')).not.toBeNull();

    fireEvent.load(container.querySelector('img')!);
    const loaded = box(container);

    expect(container.querySelector('.skeleton')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();

    fireEvent.error(container.querySelector('img')!);
    const failed = box(container);

    // The image is gone and a mark stands in its place, in a box of exactly the same dimensions.
    expect(container.querySelector('img')).toBeNull();
    expect(loaded).toEqual(loading);
    expect(failed).toEqual(loading);
  });

  it('reserves the box before there is anything to put in it', () => {
    const { container } = render(<Img src={null} alt="" width={200} height={80} />);

    expect(box(container)).toEqual({ width: '200px', height: '80px', aspectRatio: '' });
    expect(container.querySelector('img')).toBeNull();
  });

  it('draws a caller-supplied mark rather than the generic one', () => {
    const { container } = render(
      <Img src={null} alt="" width={40} height={40} fallback={<span>ع</span>} />,
    );

    expect(container.textContent).toBe('ع');
  });
});

describe('Img loading priority', () => {
  it('is lazy and asynchronous by default, for a grid of them', () => {
    const { container } = render(<Img src={SRC} alt="أشعة" aspectRatio="1/1" />);
    const image = container.querySelector('img')!;

    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image).not.toHaveAttribute('fetchpriority');
  });

  it('is eager and high priority when it is the thing being waited for', () => {
    const { container } = render(<Img src={SRC} alt="" width={212} height={56} priority />);
    const image = container.querySelector('img')!;

    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });
});

// The types are the guarantee: a call site cannot ship an unsized image, so no reviewer has to
// notice one. `tsc --noEmit` fails if any of these stops erroring.
describe('Img sizing is not optional', () => {
  it('rejects a call with no sizing and one with both', () => {
    const rejected = [
      // @ts-expect-error sizing is required — neither ratio nor dimensions given
      <Img key="none" src={SRC} alt="أشعة" />,
      // @ts-expect-error a fluid box and a fixed one are not the same box
      <Img key="both" src={SRC} alt="أشعة" aspectRatio="1/1" width={40} height={40} />,
      // @ts-expect-error a fixed box needs both numbers, or it reserves nothing vertically
      <Img key="half" src={SRC} alt="أشعة" width={40} />,
    ];

    expect(rejected).toHaveLength(3);
  });
});
