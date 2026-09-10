// Minimal typings for `bidi-js`, which ships as plain JavaScript; only the surface the PDF renderer
// uses.
declare module 'bidi-js' {
  export interface EmbeddingLevels {
    readonly levels: Uint8Array;
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
