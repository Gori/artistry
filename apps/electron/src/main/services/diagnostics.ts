import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

interface SystemInfo {
  macOSVersion: string;
  macOSBuild: string;
  architecture: string;
  logicProVersion: string | null;
  logicProInstalled: boolean;
  totalMemoryGB: number;
  cpuModel: string;
}

interface PermissionStatus {
  accessibilityGranted: boolean;
  fullDiskAccessGranted: boolean;
}

interface DiskSpaceInfo {
  path: string;
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
  percentUsed: number;
}

/**
 * Provides system diagnostics relevant to the Artistry Electron app,
 * including macOS version, Logic Pro availability, accessibility
 * permissions, and disk space.
 */
export class Diagnostics {
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Collect comprehensive system information.
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const [macOS, arch, memory, cpu, logicVersion] = await Promise.all([
      this.getMacOSVersion(),
      this.getArchitecture(),
      this.getTotalMemory(),
      this.getCpuModel(),
      this.getLogicProVersion(),
    ]);

    return {
      macOSVersion: macOS.version,
      macOSBuild: macOS.build,
      architecture: arch,
      logicProVersion: logicVersion,
      logicProInstalled: logicVersion !== null,
      totalMemoryGB: memory,
      cpuModel: cpu,
    };
  }

  /**
   * Check whether the app has the permissions needed for AppleScript
   * automation of Logic Pro.
   */
  async checkPermissions(): Promise<PermissionStatus> {
    const [accessibility, fullDisk] = await Promise.all([
      this.checkAccessibilityPermission(),
      this.checkFullDiskAccess(),
    ]);

    return {
      accessibilityGranted: accessibility,
      fullDiskAccessGranted: fullDisk,
    };
  }

  /**
   * Get the installed Logic Pro version, or null if not installed.
   * Tries `mdls` first (reads Spotlight metadata), falls back to
   * AppleScript.
   */
  async getLogicProVersion(): Promise<string | null> {
    // Strategy 1: mdls on the application bundle
    try {
      const { stdout } = await execFileAsync("mdls", [
        "-name",
        "kMDItemVersion",
        "/Applications/Logic Pro.app",
      ]);

      const match = stdout.match(/"(.+?)"/);
      if (match) return match[1];
    } catch {
      // Logic Pro might not be at the standard path
    }

    // Strategy 2: Try the older app name
    try {
      const { stdout } = await execFileAsync("mdls", [
        "-name",
        "kMDItemVersion",
        "/Applications/Logic Pro X.app",
      ]);

      const match = stdout.match(/"(.+?)"/);
      if (match) return match[1];
    } catch {
      // Not found under old name either
    }

    // Strategy 3: Fallback to defaults read on the bundle plist
    try {
      const { stdout } = await execFileAsync("defaults", [
        "read",
        "/Applications/Logic Pro.app/Contents/Info.plist",
        "CFBundleShortVersionString",
      ]);
      const version = stdout.trim();
      if (version) return version;
    } catch {
      // Plist read failed
    }

    // Strategy 4: AppleScript (requires Logic Pro to be running)
    try {
      const { stdout } = await execFileAsync("osascript", [
        "-e",
        'tell application "Logic Pro" to return version',
      ]);
      const version = stdout.trim();
      if (version) return version;
    } catch {
      // Logic Pro not running
    }

    return null;
  }

  /**
   * Check available disk space at the given path.
   */
  async checkDiskSpace(path: string): Promise<DiskSpaceInfo> {
    try {
      // Use `df` with POSIX block-size output (1024-byte blocks)
      const { stdout } = await execFileAsync("df", ["-k", path]);

      const lines = stdout.trim().split("\n");
      if (lines.length < 2) {
        throw new Error("Unexpected df output");
      }

      // Parse the second line: Filesystem 1024-blocks Used Available Capacity ...
      const parts = lines[1].split(/\s+/);
      const totalBlocks = parseInt(parts[1], 10);
      const usedBlocks = parseInt(parts[2], 10);
      const availableBlocks = parseInt(parts[3], 10);

      const totalBytes = totalBlocks * 1024;
      const usedBytes = usedBlocks * 1024;
      const availableBytes = availableBlocks * 1024;
      const percentUsed =
        totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

      return {
        path,
        totalBytes,
        availableBytes,
        usedBytes,
        percentUsed,
      };
    } catch (error) {
      throw new Error(
        `Failed to check disk space at "${path}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getMacOSVersion(): Promise<{
    version: string;
    build: string;
  }> {
    try {
      const { stdout } = await execFileAsync("sw_vers");
      const versionMatch = stdout.match(/ProductVersion:\s*(.+)/);
      const buildMatch = stdout.match(/BuildVersion:\s*(.+)/);

      return {
        version: versionMatch ? versionMatch[1].trim() : "unknown",
        build: buildMatch ? buildMatch[1].trim() : "unknown",
      };
    } catch {
      return { version: "unknown", build: "unknown" };
    }
  }

  private async getArchitecture(): Promise<string> {
    try {
      const { stdout } = await execFileAsync("uname", ["-m"]);
      return stdout.trim(); // "arm64" or "x86_64"
    } catch {
      return "unknown";
    }
  }

  private async getTotalMemory(): Promise<number> {
    try {
      const { stdout } = await execFileAsync("sysctl", ["-n", "hw.memsize"]);
      const bytes = parseInt(stdout.trim(), 10);
      return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
    } catch {
      return 0;
    }
  }

  private async getCpuModel(): Promise<string> {
    try {
      const { stdout } = await execFileAsync("sysctl", [
        "-n",
        "machdep.cpu.brand_string",
      ]);
      return stdout.trim();
    } catch {
      return "unknown";
    }
  }

  /**
   * Check accessibility permission by attempting a harmless System Events query.
   */
  private async checkAccessibilityPermission(): Promise<boolean> {
    const script = `
      try
        tell application "System Events"
          set frontApp to name of first process whose frontmost is true
        end tell
        return "granted"
      on error errMsg
        return "denied"
      end try
    `;

    try {
      const { stdout } = await execFileAsync("osascript", ["-e", script], {
        timeout: 10_000,
      });
      return stdout.trim() === "granted";
    } catch {
      return false;
    }
  }

  /**
   * Check full disk access by attempting to read a protected path.
   * This is a heuristic -- full disk access is difficult to verify
   * programmatically.
   */
  private async checkFullDiskAccess(): Promise<boolean> {
    try {
      // ~/Library/Mail is protected by TCC; if we can list it, we have access.
      const homeDir = process.env.HOME ?? "/Users/" + process.env.USER;
      await execFileAsync("ls", [`${homeDir}/Library/Mail`], {
        timeout: 5_000,
      });
      return true;
    } catch {
      return false;
    }
  }
}
