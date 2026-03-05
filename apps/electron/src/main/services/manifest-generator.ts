import { readdir, stat, readFile } from "fs/promises";
import { createHash } from "crypto";
import { join, relative } from "path";

interface ManifestEntry {
  path: string;
  sha256: string;
  size: number;
  mtime: number;
}

interface Manifest {
  entries: ManifestEntry[];
  totalSize: number;
  fileCount: number;
}

const IGNORE_FILES = new Set([
  ".DS_Store",
  "Thumbs.db",
  ".git",
  "projectData.lock",
]);

const CONCURRENCY = 8;

export class ManifestGenerator {
  /**
   * Generate a manifest for a directory by walking all files
   * and computing SHA-256 hashes in parallel.
   */
  async generate(rootPath: string): Promise<Manifest> {
    // Collect all file paths
    const filePaths = await this.walkDirectory(rootPath);

    // Hash files in parallel with concurrency limit
    const entries: ManifestEntry[] = [];
    for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
      const batch = filePaths.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((filePath) => this.hashFile(rootPath, filePath))
      );
      entries.push(...results);
    }

    // Sort for deterministic manifests
    entries.sort((a, b) => a.path.localeCompare(b.path));

    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);

    return {
      entries,
      totalSize,
      fileCount: entries.length,
    };
  }

  private async walkDirectory(dirPath: string): Promise<string[]> {
    const result: string[] = [];
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORE_FILES.has(entry.name)) continue;

      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.walkDirectory(fullPath);
        result.push(...subFiles);
      } else if (entry.isFile()) {
        result.push(fullPath);
      }
    }

    return result;
  }

  private async hashFile(
    rootPath: string,
    filePath: string
  ): Promise<ManifestEntry> {
    const [fileData, fileStat] = await Promise.all([
      readFile(filePath),
      stat(filePath),
    ]);

    const hash = createHash("sha256");
    hash.update(fileData);
    const sha256 = hash.digest("hex");

    return {
      path: relative(rootPath, filePath),
      sha256,
      size: fileStat.size,
      mtime: Math.floor(fileStat.mtimeMs),
    };
  }
}
