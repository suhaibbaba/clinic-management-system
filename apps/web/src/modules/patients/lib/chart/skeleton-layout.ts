import { BODY_SIDE, type BodySide } from "@clinic/shared";

export const SKELETON_VIEWBOX = { width: 435.7, height: 841.9 } as const;

export const SKELETON_VIEWS = ["front", "back"] as const;

export type SkeletonView = (typeof SKELETON_VIEWS)[number];

type Outline = readonly number[] | { readonly cx: number; readonly cy: number; readonly r: number };

type ViewOutlines = Readonly<Record<string, Outline>>;

const joint = (cx: number, cy: number, r: number): Outline => ({ cx, cy, r });

const FRONT: ViewOutlines = {
  "pelvis:midline": [
    132, 345, 150, 322, 186, 330, 222, 330, 258, 322, 276, 345, 268, 375, 250, 395, 245, 422, 205,
    430, 162, 422, 156, 395, 138, 375,
  ],
  "ribs:right": [
    148, 158, 190, 156, 190, 178, 194, 200, 196, 238, 190, 246, 190, 300, 165, 300, 140, 295, 132,
    270, 133, 220, 136, 190,
  ],
  "ribs:left": [
    259, 158, 217, 156, 217, 178, 213, 200, 211, 238, 217, 246, 217, 300, 242, 300, 267, 295, 275,
    270, 274, 220, 271, 190,
  ],
  "humerus:right": [104, 184, 130, 184, 122, 200, 104, 250, 100, 292, 68, 292, 78, 250, 100, 200],
  "humerus:left": [281, 184, 300, 184, 310, 200, 324, 250, 330, 292, 296, 292, 300, 250, 290, 200],
  "radius:right": [66, 308, 82, 308, 80, 360, 78, 406, 63, 406, 66, 360],
  "ulna:right": [82, 308, 100, 308, 93, 360, 92, 406, 78, 406, 80, 360],
  "ulna:left": [302, 309, 316, 309, 331, 360, 342, 404, 332, 406, 318, 360],
  "radius:left": [316, 309, 328, 309, 345, 360, 362, 402, 344, 406, 331, 360],
  "hand:right": [58, 418, 95, 416, 122, 452, 105, 465, 98, 500, 62, 500, 56, 460],
  "hand:left": [330, 412, 372, 402, 410, 425, 410, 450, 380, 446, 374, 500, 334, 500, 327, 450],
  "femur:right": [
    120, 388, 146, 374, 152, 395, 164, 450, 180, 500, 193, 550, 198, 580, 196, 592, 151, 592, 151,
    560, 150, 500, 138, 450, 122, 410,
  ],
  "femur:left": [
    284, 388, 260, 374, 254, 395, 244, 450, 228, 500, 214, 550, 207, 580, 208, 592, 250, 592, 250,
    560, 255, 500, 263, 450, 282, 410,
  ],
  "tibia:right": [162, 606, 197, 604, 194, 650, 190, 700, 196, 760, 178, 768, 170, 700, 170, 650],
  "fibula:right": [151, 606, 163, 606, 171, 650, 176, 700, 178, 768, 166, 768, 162, 700, 158, 650],
  "tibia:left": [206, 604, 240, 606, 236, 650, 232, 700, 228, 768, 205, 768, 210, 700, 212, 650],
  "fibula:left": [240, 606, 252, 606, 246, 650, 240, 700, 236, 768, 224, 768, 229, 700, 234, 650],
  "foot:right": [166, 768, 196, 768, 196, 790, 185, 812, 160, 826, 128, 820, 140, 800],
  "foot:left": [200, 768, 232, 768, 262, 800, 272, 820, 240, 826, 215, 812, 203, 790],
  "cervical_spine:midline": [186, 123, 222, 123, 224, 148, 184, 148],
  "thoracic_spine:midline": [190, 246, 216, 246, 216, 300, 190, 300],
  "lumbar_spine:midline": [183, 300, 224, 300, 224, 350, 183, 350],
  "sacrum:midline": [178, 350, 228, 350, 222, 370, 210, 395, 196, 395, 184, 370],
  "sternum:midline": [
    192, 152, 214, 152, 216, 175, 211, 200, 210, 240, 204, 250, 198, 240, 196, 200, 190, 175,
  ],
  "clavicle:right": [118, 142, 150, 140, 196, 146, 198, 156, 150, 152, 120, 152],
  "clavicle:left": [210, 146, 258, 140, 296, 142, 298, 152, 258, 152, 211, 157],
  "shoulder:right": joint(122, 175, 12),
  "shoulder:left": joint(285, 175, 12),
  "elbow:right": joint(85, 303, 13),
  "elbow:left": joint(314, 304, 13),
  "wrist:right": joint(78, 411, 11),
  "wrist:left": joint(350, 410, 11),
  "hip:right": joint(152, 381, 12),
  "hip:left": joint(250, 380, 12),
  "knee:right": joint(174, 592, 18),
  "knee:left": joint(228, 592, 18),
  "ankle:right": joint(180, 765, 10),
  "ankle:left": joint(214, 765, 10),
};

const BACK: ViewOutlines = {
  "pelvis:midline": [
    142, 375, 160, 345, 190, 340, 244, 340, 270, 342, 290, 370, 282, 400, 270, 440, 220, 445, 160,
    440, 150, 400,
  ],
  "ribs:left": [150, 170, 197, 166, 197, 300, 175, 303, 150, 285, 143, 250, 145, 210],
  "ribs:right": [282, 170, 236, 166, 236, 300, 258, 303, 282, 285, 289, 250, 287, 210],
  "scapula:left": [112, 160, 150, 152, 178, 165, 176, 200, 160, 232, 140, 240, 125, 200, 118, 175],
  "scapula:right": [318, 160, 282, 152, 253, 165, 256, 200, 272, 232, 292, 240, 306, 200, 312, 175],
  "humerus:left": [104, 195, 126, 195, 120, 250, 118, 300, 116, 318, 88, 318, 96, 300, 104, 250],
  "humerus:right": [306, 195, 326, 195, 330, 250, 338, 300, 340, 318, 308, 318, 310, 300, 308, 250],
  "radius:left": [88, 322, 100, 322, 92, 375, 89, 424, 73, 424, 80, 375],
  "ulna:left": [100, 322, 116, 322, 108, 375, 101, 424, 89, 424, 92, 375],
  "ulna:right": [310, 322, 328, 322, 328, 375, 330, 424, 314, 424, 312, 375],
  "radius:right": [328, 322, 342, 322, 342, 375, 345, 424, 330, 424, 328, 375],
  "hand:left": [72, 432, 102, 432, 126, 455, 124, 500, 100, 515, 70, 515, 68, 470],
  "hand:right": [312, 432, 345, 432, 372, 470, 352, 480, 345, 515, 315, 515, 310, 470],
  "femur:left": [
    132, 400, 160, 394, 168, 420, 170, 450, 180, 500, 198, 550, 208, 580, 208, 597, 165, 597, 166,
    560, 155, 500, 146, 450, 134, 425,
  ],
  "femur:right": [
    296, 400, 270, 394, 262, 420, 260, 450, 250, 500, 232, 550, 222, 580, 222, 597, 264, 597, 262,
    560, 272, 500, 283, 450, 294, 425,
  ],
  "fibula:left": [164, 608, 180, 608, 184, 680, 190, 775, 178, 778, 172, 680],
  "tibia:left": [180, 604, 212, 604, 208, 680, 210, 775, 190, 778, 186, 680],
  "tibia:right": [218, 604, 250, 604, 246, 680, 244, 778, 224, 778, 222, 680],
  "fibula:right": [250, 608, 266, 608, 258, 680, 256, 778, 244, 778, 248, 680],
  "foot:left": [176, 782, 212, 782, 212, 815, 176, 820, 140, 818, 150, 795],
  "foot:right": [220, 782, 256, 782, 285, 800, 295, 818, 256, 820, 220, 815],
  "cervical_spine:midline": [198, 103, 234, 103, 236, 150, 196, 150],
  "thoracic_spine:midline": [199, 151, 233, 151, 233, 294, 199, 294],
  "lumbar_spine:midline": [190, 294, 242, 294, 242, 352, 190, 352],
  "sacrum:midline": [188, 352, 244, 352, 238, 385, 225, 405, 208, 405, 194, 385],
  "clavicle:left": [128, 150, 195, 155, 196, 166, 130, 160],
  "clavicle:right": [305, 150, 238, 155, 236, 166, 302, 160],
  "shoulder:left": joint(122, 186, 11),
  "shoulder:right": joint(310, 186, 11),
  "elbow:left": joint(104, 316, 13),
  "elbow:right": joint(325, 316, 13),
  "wrist:left": joint(88, 428, 10),
  "wrist:right": joint(329, 428, 10),
  "hip:left": joint(158, 402, 11),
  "hip:right": joint(272, 402, 11),
  "knee:left": joint(186, 594, 18),
  "knee:right": joint(242, 594, 18),
  "ankle:left": joint(194, 778, 10),
  "ankle:right": joint(238, 778, 10),
};

const OUTLINES: Readonly<Record<SkeletonView, ViewOutlines>> = { front: FRONT, back: BACK };

const STACKING: readonly string[] = [
  "pelvis",
  "ribs",
  "scapula",
  "humerus",
  "radius",
  "ulna",
  "hand",
  "femur",
  "tibia",
  "fibula",
  "foot",
  "cervical_spine",
  "thoracic_spine",
  "lumbar_spine",
  "sacrum",
  "sternum",
  "clavicle",
  "shoulder",
  "elbow",
  "wrist",
  "hip",
  "knee",
  "ankle",
];

function toPath(outline: Outline): string {
  if ("cx" in outline) {
    const { cx, cy, r } = outline;
    return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  }

  const pairs = Array.from(
    { length: outline.length / 2 },
    (_, index) => `${outline[index * 2]} ${outline[index * 2 + 1]}`,
  );

  return `M${pairs.join("L")}Z`;
}

export function skeletonOutline(
  view: SkeletonView,
  region: string,
  side: BodySide | undefined,
): string | undefined {
  const outline = OUTLINES[view][`${region}:${side ?? BODY_SIDE.MIDLINE}`];

  return outline && toPath(outline);
}

export function stackingOrder(region: string): number {
  const index = STACKING.indexOf(region);

  return index === -1 ? STACKING.length : index;
}
