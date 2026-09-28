export async function uploadToStorage(
  uploadUrl: string,
  body: Blob,
  contentType: string = body.type,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}
