import { readFile } from "fs/promises";
import { basename } from "path";

interface UploadResult {
  url: string;
  sha256: string;
  size: number;
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const WEB_URL = "http://localhost:3003";

export class UploadManager {
  /**
   * Upload a single file to R2 via the web app's API route, with retry and backoff.
   */
  async uploadFile(filePath: string, sha256: string): Promise<UploadResult> {
    const fileData = await readFile(filePath);
    const fileName = basename(filePath);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const formData = new FormData();
        formData.append(
          "file",
          new Blob([fileData]),
          fileName
        );
        formData.append("sha256", sha256);

        const response = await fetch(
          `${WEB_URL}/api/upload/logic-blob`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(
            `Upload failed (${response.status}): ${text}`
          );
        }

        const result = await response.json();
        return {
          url: result.url,
          sha256: result.sha256,
          size: result.size,
        };
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_RETRIES - 1) {
          const backoff =
            INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          await new Promise((resolve) =>
            setTimeout(resolve, backoff)
          );
        }
      }
    }

    throw lastError ?? new Error("Upload failed after retries");
  }
}
