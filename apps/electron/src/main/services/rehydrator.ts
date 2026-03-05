import { mkdir, writeFile } from "fs/promises";
import { createHash } from "crypto";
import { dirname, join } from "path";

interface DownloadEntry {
  path: string;
  url: string;
  size: number;
}

interface ProgressCallback {
  (progress: { phase: string; current: number; total: number }): void;
}

const CONCURRENCY = 4;

export class Rehydrator {
  /**
   * Download all blobs and assemble them into a .logicx directory structure.
   */
  async rehydrate(
    entries: DownloadEntry[],
    targetPath: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    // Create target directory
    await mkdir(targetPath, { recursive: true });

    // Download and write files with concurrency limit
    let completed = 0;

    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      const batch = entries.slice(i, i + CONCURRENCY);

      await Promise.all(
        batch.map(async (entry) => {
          const filePath = join(targetPath, entry.path);

          // Ensure parent directory exists
          await mkdir(dirname(filePath), { recursive: true });

          // Download file
          const response = await fetch(entry.url);
          if (!response.ok) {
            throw new Error(
              `Failed to download ${entry.path}: ${response.status}`
            );
          }

          const buffer = Buffer.from(await response.arrayBuffer());

          // Verify size
          if (buffer.length !== entry.size) {
            throw new Error(
              `Size mismatch for ${entry.path}: expected ${entry.size}, got ${buffer.length}`
            );
          }

          // Write file
          await writeFile(filePath, buffer);

          completed++;
          onProgress?.({
            phase: "downloading",
            current: completed,
            total: entries.length,
          });
        })
      );
    }
  }
}
