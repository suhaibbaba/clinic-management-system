export interface SignedUpload {
  readonly key: string;
  readonly uploadUrl: string;
  readonly expiresAt: Date;
}

export interface SignedDownload {
  readonly url: string;
  readonly expiresAt: Date;
}

export interface StoredObject {
  readonly sizeBytes: number;
  readonly mime: string | undefined;
}

export function sanitiseFilename(filename: string): string {
  return (
    filename
      .replace(/[\\/\r\n"]/g, "")
      .replace(/\s+/g, "_")
      .slice(-120) || "file"
  );
}

export function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "NotFound" || candidate.$metadata?.httpStatusCode === 404;
}
