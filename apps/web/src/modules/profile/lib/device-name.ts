const DEVICES: readonly (readonly [RegExp, string])[] = [
  [/iPhone/i, "iPhone"],
  [/iPad/i, "iPad"],
  [/Android/i, "Android"],
  [/Macintosh|Mac OS X/i, "Mac"],
  [/Windows/i, "Windows"],
  [/CrOS/i, "Chromebook"],
  [/Linux/i, "Linux"],
];

export function deviceName(userAgent: string): string {
  return DEVICES.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "";
}
