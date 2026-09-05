import { FDI_DECIDUOUS_TEETH, FDI_PERMANENT_TEETH } from '@clinic/shared';

/**
 * Where every tooth sits in the SVG.
 *
 * Teeth are laid out along two elliptical arches by **arc length**, not by
 * equal angles: on an ellipse a degree near the front covers far more distance
 * than a degree near the molars, so equal angles would spread the incisors out
 * and crush the molars together. Walking the curve by distance, and giving each
 * tooth a share proportional to its real width, is what makes the arch read as
 * an arch.
 *
 * The result is pure data — positions, rotations and path strings — so the
 * layout is unit-testable without rendering anything.
 */

export type Dentition = 'permanent' | 'deciduous';

/**
 * Viewport the chart is drawn in; the SVG scales, these units never change.
 *
 * Cropped to what the arches actually occupy — a viewBox with dead margins
 * would shrink the teeth to fit the empty space around them.
 */
export const CHART_VIEWBOX = { x: 30, y: 26, width: 560, height: 398 } as const;

const CENTER_X = 310;
/**
 * The two arch centres sit well apart, and the arches themselves are flatter
 * than they are wide. Bring the centres together or deepen the curves and the
 * molars meet at the sides: the two horseshoes close into a single ring, which
 * is not what a mouth looks like and not how a chart is read.
 */
const UPPER_CENTER_Y = 192;
const LOWER_CENTER_Y = 268;

interface ArchGeometry {
  readonly rx: number;
  readonly ry: number;
  readonly toothScale: number;
}

const ARCHES: Record<Dentition, ArchGeometry> = {
  permanent: { rx: 248, ry: 122, toothScale: 1 },
  // A child's arch is smaller, and 20 teeth in it stay comfortably apart.
  deciduous: { rx: 200, ry: 100, toothScale: 1.1 },
};

/**
 * Relative crown width and height per position in the quadrant, keyed by the
 * second FDI digit. Molars are the widest, canines the tallest — enough for the
 * arch to look anatomical without pretending to be a textbook illustration.
 */
const PERMANENT_PROPORTIONS: Record<number, { width: number; height: number }> = {
  1: { width: 1.0, height: 1.25 },
  2: { width: 0.85, height: 1.15 },
  3: { width: 0.95, height: 1.35 },
  4: { width: 1.0, height: 1.05 },
  5: { width: 1.0, height: 1.05 },
  6: { width: 1.35, height: 1.1 },
  7: { width: 1.3, height: 1.1 },
  8: { width: 1.15, height: 1.0 },
};

const DECIDUOUS_PROPORTIONS: Record<number, { width: number; height: number }> = {
  1: { width: 0.95, height: 1.15 },
  2: { width: 0.85, height: 1.05 },
  3: { width: 0.9, height: 1.2 },
  4: { width: 1.15, height: 1.0 },
  5: { width: 1.25, height: 1.0 },
};

const BASE_TOOTH = { width: 26, height: 26 };

/** Positions 1–3 are incisors and canines; 4 and up bite rather than cut. */
const isAnterior = (position: number): boolean => position <= 3;

export interface ToothGeometry {
  /** FDI number. */
  readonly tooth: number;
  readonly arch: 'upper' | 'lower';
  /** Centre of the crown. */
  readonly x: number;
  readonly y: number;
  /** Degrees; turns the crown to face away from the centre of the mouth. */
  readonly rotation: number;
  readonly width: number;
  readonly height: number;
  /** Crown outline, in coordinates local to the tooth's own centre. */
  readonly path: string;
  /** Occlusal groove for posterior teeth; empty for anteriors. */
  readonly groove: string;
  /** Where the number is drawn — outside the arch, and never rotated. */
  readonly labelX: number;
  readonly labelY: number;
}

/** Teeth of one arch, ordered as the viewer sees them: left to right. */
function archOrder(dentition: Dentition, arch: 'upper' | 'lower'): number[] {
  const all = dentition === 'permanent' ? FDI_PERMANENT_TEETH : FDI_DECIDUOUS_TEETH;
  const quadrants = dentition === 'permanent' ? [1, 2, 3, 4] : [5, 6, 7, 8];

  // Charts are drawn from the clinician's point of view, so the patient's right
  // (quadrants 1 and 4) appears on the viewer's left, counting down to the
  // midline and back up.
  const [upperRight, upperLeft, lowerLeft, lowerRight] = quadrants as [
    number,
    number,
    number,
    number,
  ];

  const inQuadrant = (quadrant: number): number[] =>
    all.filter((tooth) => Math.floor(tooth / 10) === quadrant);

  if (arch === 'upper') {
    return [...inQuadrant(upperRight).reverse(), ...inQuadrant(upperLeft)];
  }

  return [...inQuadrant(lowerRight).reverse(), ...inQuadrant(lowerLeft)];
}

/**
 * Samples the half-ellipse so a distance along the curve can be turned back
 * into an angle. 720 steps is well past the point where more changes a pixel.
 */
function sampleArc(rx: number, ry: number): { angles: number[]; lengths: number[] } {
  const steps = 720;
  const angles: number[] = [];
  const lengths: number[] = [0];

  let previousX = rx;
  let previousY = 0;
  let total = 0;

  for (let index = 0; index <= steps; index += 1) {
    // From π (viewer's left) to 0 (viewer's right).
    const angle = Math.PI - (index / steps) * Math.PI;
    const x = rx * Math.cos(angle);
    const y = ry * Math.sin(angle);

    if (index > 0) {
      total += Math.hypot(x - previousX, y - previousY);
      lengths.push(total);
    }

    angles.push(angle);
    previousX = x;
    previousY = y;
  }

  // The walk starts at π, so the first sample is the left end of the curve.
  return { angles, lengths };
}

/** The angle at a given distance along the sampled curve. */
function angleAtLength(samples: { angles: number[]; lengths: number[] }, target: number): number {
  const { angles, lengths } = samples;

  for (let index = 1; index < lengths.length; index += 1) {
    const previous = lengths[index - 1] ?? 0;
    const current = lengths[index] ?? 0;

    if (current >= target) {
      const span = current - previous;
      const ratio = span === 0 ? 0 : (target - previous) / span;
      const from = angles[index - 1] ?? Math.PI;
      const to = angles[index] ?? 0;
      return from + (to - from) * ratio;
    }
  }

  return angles[angles.length - 1] ?? 0;
}

/** A crown that cuts: wider at the biting edge, tapering to the neck. */
function anteriorPath(width: number, height: number): string {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const corner = Math.min(halfWidth, halfHeight) * 0.45;
  const neck = halfWidth * 0.74;

  return [
    `M ${-neck} ${halfHeight}`,
    `L ${-halfWidth} ${-halfHeight + corner}`,
    `Q ${-halfWidth} ${-halfHeight} ${-halfWidth + corner} ${-halfHeight}`,
    `L ${halfWidth - corner} ${-halfHeight}`,
    `Q ${halfWidth} ${-halfHeight} ${halfWidth} ${-halfHeight + corner}`,
    `L ${neck} ${halfHeight}`,
    `Q 0 ${halfHeight + height * 0.14} ${-neck} ${halfHeight}`,
    'Z',
  ].join(' ');
}

/** A crown that grinds: a rounded box with two cusps on the biting edge. */
function posteriorPath(width: number, height: number): string {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const corner = Math.min(halfWidth, halfHeight) * 0.34;
  const cusp = height * 0.12;

  return [
    `M ${-halfWidth + corner} ${-halfHeight}`,
    `Q ${-halfWidth * 0.5} ${-halfHeight - cusp} 0 ${-halfHeight + height * 0.04}`,
    `Q ${halfWidth * 0.5} ${-halfHeight - cusp} ${halfWidth - corner} ${-halfHeight}`,
    `Q ${halfWidth} ${-halfHeight} ${halfWidth} ${-halfHeight + corner}`,
    `L ${halfWidth} ${halfHeight - corner}`,
    `Q ${halfWidth} ${halfHeight} ${halfWidth - corner} ${halfHeight}`,
    `L ${-halfWidth + corner} ${halfHeight}`,
    `Q ${-halfWidth} ${halfHeight} ${-halfWidth} ${halfHeight - corner}`,
    `L ${-halfWidth} ${-halfHeight + corner}`,
    `Q ${-halfWidth} ${-halfHeight} ${-halfWidth + corner} ${-halfHeight}`,
    'Z',
  ].join(' ');
}

function layoutArch(
  dentition: Dentition,
  arch: 'upper' | 'lower',
  geometry: ArchGeometry,
): ToothGeometry[] {
  const teeth = archOrder(dentition, arch);
  const proportions = dentition === 'permanent' ? PERMANENT_PROPORTIONS : DECIDUOUS_PROPORTIONS;

  const widths = teeth.map(
    (tooth) => (proportions[tooth % 10] ?? { width: 1 }).width * geometry.toothScale,
  );
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);

  const samples = sampleArc(geometry.rx, geometry.ry);
  const totalLength = samples.lengths[samples.lengths.length - 1] ?? 0;

  const centerY = arch === 'upper' ? UPPER_CENTER_Y : LOWER_CENTER_Y;
  // The lower arch is the upper one flipped about the horizontal axis.
  const verticalSign = arch === 'upper' ? -1 : 1;

  let consumed = 0;

  return teeth.map((tooth, index) => {
    const share = widths[index] ?? 1;
    // Each tooth sits at the middle of its own share of the curve.
    const angle = angleAtLength(samples, ((consumed + share / 2) / totalWidth) * totalLength);
    consumed += share;

    const position = tooth % 10;
    const proportion = proportions[position] ?? { width: 1, height: 1 };
    const width = BASE_TOOTH.width * proportion.width * geometry.toothScale;
    const height = BASE_TOOTH.height * proportion.height * geometry.toothScale;

    const x = CENTER_X + geometry.rx * Math.cos(angle);
    const y = centerY + verticalSign * geometry.ry * Math.sin(angle);

    const degrees = (angle * 180) / Math.PI;
    // Turn the crown so its biting edge faces out of the mouth.
    const rotation = arch === 'upper' ? 90 - degrees : 90 + degrees;

    // Outward normal, used to push the number clear of the crown.
    const outwardX = Math.cos(angle);
    const outwardY = verticalSign * Math.sin(angle);
    const labelDistance = height / 2 + 12;

    return {
      tooth,
      arch,
      x,
      y,
      rotation,
      width,
      height,
      path: isAnterior(position) ? anteriorPath(width, height) : posteriorPath(width, height),
      groove: isAnterior(position)
        ? ''
        : `M ${-width * 0.28} ${-height * 0.05} L ${width * 0.28} ${-height * 0.05}`,
      labelX: x + outwardX * labelDistance,
      labelY: y + outwardY * labelDistance,
    };
  });
}

/** Every tooth of one dentition, upper arch first, each left to right. */
export function layoutTeeth(dentition: Dentition): ToothGeometry[] {
  const geometry = ARCHES[dentition];

  return [...layoutArch(dentition, 'upper', geometry), ...layoutArch(dentition, 'lower', geometry)];
}

/**
 * Reading order for the keyboard: the upper arch left to right, then the lower.
 * Arrow keys walk this list, so focus moves the way the eye does.
 */
export function navigationOrder(dentition: Dentition): number[] {
  return layoutTeeth(dentition).map((tooth) => tooth.tooth);
}
