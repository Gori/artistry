import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

export class Snapshotter {
  /**
   * Create a snapshot of a .logicx directory.
   * On macOS with APFS, uses `cp -c` for instant copy-on-write clones.
   * Falls back to recursive copy on other filesystems.
   */
  async createSnapshot(projectPath: string): Promise<string> {
    const snapshotDir = await mkdtemp(
      join(tmpdir(), "artistry-snapshot-")
    );
    const snapshotPath = join(snapshotDir, "project");

    try {
      // Try APFS clone first (instant, no extra disk space)
      await execFileAsync("cp", ["-Rc", projectPath, snapshotPath]);
    } catch {
      // Fallback to regular recursive copy
      try {
        await execFileAsync("cp", ["-R", projectPath, snapshotPath]);
      } catch (copyError) {
        // Clean up on failure
        await rm(snapshotDir, { recursive: true, force: true }).catch(
          () => {}
        );
        throw copyError;
      }
    }

    return snapshotPath;
  }

  /**
   * Remove a snapshot after upload is complete.
   */
  async cleanup(snapshotPath: string): Promise<void> {
    // Go up one level to remove the temp directory
    const parentDir = join(snapshotPath, "..");
    await rm(parentDir, { recursive: true, force: true });
  }
}
