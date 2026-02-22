import { useCallback } from "react";

export function useImageUpload() {
  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const result = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!result.ok) {
      throw new Error("Failed to upload image");
    }

    const { url } = await result.json();
    return url;
  }, []);

  return { uploadImage };
}
