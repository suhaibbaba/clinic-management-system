// One seeded generator for the whole seed, so a rebuild produces the same clinic: a demo that
// reshuffles itself is a demo nobody can point at twice.
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** mulberry32 — small, fast, and good enough for choosing a name. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  /** Inclusive at both ends, which is how ranges are written below. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(values: readonly T[]): T {
    const value = values[Math.floor(this.next() * values.length)];

    if (value === undefined) {
      throw new Error('Cannot pick from an empty list');
    }

    return value;
  }

  /** Distinct members, or the whole list when it is shorter than `count`. */
  sample<T>(values: readonly T[], count: number): T[] {
    return this.shuffle(values).slice(0, count);
  }

  shuffle<T>(values: readonly T[]): T[] {
    const copy = [...values];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(this.next() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T];
    }

    return copy;
  }

  /** A value weighted towards the low end — most patients have few visits, a handful have many. */
  skewedInt(min: number, max: number): number {
    return min + Math.floor(this.next() * this.next() * (max - min + 1));
  }
}
