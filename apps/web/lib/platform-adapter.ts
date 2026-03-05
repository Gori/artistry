import type { PlatformAdapter } from "@artistry/platform";

async function uploadViaFetch(
  endpoint: string,
  file: File
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const result = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });
  if (!result.ok) throw new Error("Upload failed");
  return result.json();
}

export const webPlatformAdapter: PlatformAdapter = {
  uploadAudio: (file) => uploadViaFetch("/api/upload/audio", file),
  uploadImage: (file) => uploadViaFetch("/api/upload", file),
};
