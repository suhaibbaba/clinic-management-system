export interface DocumentSource {
  readonly load: () => Promise<Blob>;
  readonly filename: string;
  readonly send?: ((to: string) => Promise<void>) | undefined;
  readonly recipient?: string | null | undefined;
}
