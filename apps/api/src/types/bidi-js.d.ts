/**
 * Minimal typings for `bidi-js`, which ships as plain JavaScript.
 *
 * Only the surface the PDF renderer uses is declared: `getEmbeddingLevels`
 * resolves the Unicode bidi algorithm's embedding level for every character,
 * which is what lets us split a mixed Arabic/Latin line into runs.
 */
declare module 'bidi-js' {
  export interface EmbeddingLevels {
    /** One embedding level per character of the input string. */
    readonly levels: Uint8Array;
    /** Index pairs of characters removed from the visual result. */
    readonly paragraphs: readonly { start: number; end: number; level: number }[];
  }

  export interface Bidi {
    getEmbeddingLevels(text: string, defaultDirection?: 'ltr' | 'rtl'): EmbeddingLevels;
    getReorderSegments(
      text: string,
      embeddingLevels: EmbeddingLevels,
      start?: number,
      end?: number,
    ): [number, number][];
    getMirroredCharacter(char: string): string | null;
  }

  export default function bidiFactory(): Bidi;
}
