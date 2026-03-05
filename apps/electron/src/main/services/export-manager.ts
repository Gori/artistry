import { execFile } from "child_process";
import { promisify } from "util";
import { readdir } from "fs/promises";
import { join } from "path";

const execFileAsync = promisify(execFile);

interface ExportedFile {
  path: string;
  trackName: string;
  trackIndex: number;
}

interface TrackInfo {
  index: number;
  name: string;
  type: "audio" | "software" | "drummer" | "external" | "unknown";
}

/**
 * Automates Logic Pro export operations via AppleScript / System Events.
 *
 * Important: macOS Accessibility permissions must be granted to the Electron
 * app before any System Events automation will work. Use
 * `Diagnostics.checkPermissions()` to verify.
 */
export class ExportManager {
  /**
   * Maximum time (ms) to wait for Logic Pro to finish a bounce operation.
   */
  private static readonly BOUNCE_TIMEOUT_MS = 300_000; // 5 minutes

  /**
   * Delay (ms) between AppleScript steps to let Logic Pro UI settle.
   */
  private static readonly UI_SETTLE_MS = 1500;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Check whether Logic Pro is currently running and responsive.
   */
  async checkLogicProAvailable(): Promise<boolean> {
    const script = `
      tell application "System Events"
        set logicRunning to (name of every process) contains "Logic Pro"
      end tell
      return logicRunning
    `;

    try {
      const { stdout } = await this.runAppleScript(script);
      return stdout.trim() === "true";
    } catch {
      return false;
    }
  }

  /**
   * Retrieve the track list from the currently-open Logic Pro project.
   * Logic Pro must already have the target project open.
   */
  async getTrackList(logicxPath: string): Promise<TrackInfo[]> {
    // Ensure the project is open
    await this.openProject(logicxPath);

    // Give Logic Pro a moment to fully open the project
    await this.delay(ExportManager.UI_SETTLE_MS);

    const script = `
      tell application "Logic Pro"
        activate
      end tell

      delay 1

      tell application "System Events"
        tell process "Logic Pro"
          -- Open the mixer to read track names
          keystroke "X" using {command down}
          delay 0.8

          set trackNames to {}
          try
            set channelStrips to every group of scroll area 1 of splitter group 1 of window 1
            repeat with cs in channelStrips
              try
                set trackName to value of static text 1 of cs
                set end of trackNames to trackName
              end try
            end repeat
          end try

          -- Close mixer
          keystroke "X" using {command down}
        end tell
      end tell

      set AppleScript's text item delimiters to "|||"
      return trackNames as text
    `;

    try {
      const { stdout } = await this.runAppleScript(script);
      const names = stdout.trim().split("|||").filter(Boolean);

      return names.map((name, index) => ({
        index: index + 1,
        name: name.trim(),
        type: this.inferTrackType(name.trim()),
      }));
    } catch (error) {
      throw new Error(
        `Failed to retrieve track list: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Export individual stems (one WAV per track) from a Logic Pro project.
   *
   * Logic Pro must be running. The project at `logicxPath` will be opened
   * (or brought to the front) before the bounce begins.
   */
  async exportStems(
    logicxPath: string,
    outputDir: string
  ): Promise<ExportedFile[]> {
    const available = await this.checkLogicProAvailable();
    if (!available) {
      throw new Error(
        "Logic Pro is not running. Please open Logic Pro before exporting stems."
      );
    }

    // Open / foreground the project
    await this.openProject(logicxPath);
    await this.delay(ExportManager.UI_SETTLE_MS * 2);

    // Select all tracks with Cmd+A (in the Tracks area)
    const selectAndBounce = `
      tell application "Logic Pro"
        activate
      end tell

      delay 1

      tell application "System Events"
        tell process "Logic Pro"
          -- Ensure the Tracks area has focus
          keystroke "1" using {command down}
          delay 0.3

          -- Select all regions: Edit > Select All (Cmd+A)
          keystroke "a" using {command down}
          delay 0.5

          -- File > Bounce > All Tracks in Place...
          -- Use the menu path for reliability
          click menu item "All Tracks in Place..." of menu "Bounce" of menu item "Bounce" of menu "File" of menu bar 1
          delay 1.5

          -- In the bounce dialog, set output format to WAV
          -- The bounce sheet should now be visible
          try
            -- Set destination directory via the path control / save panel
            -- We use a keystroke shortcut to open the save location
            keystroke "g" using {command down, shift down}
            delay 0.8

            -- Type the output directory path
            set value of text field 1 of sheet 1 of sheet 1 of window 1 to "${outputDir.replace(/"/g, '\\"')}"
            delay 0.3
            keystroke return
            delay 0.5
          end try

          -- Click Bounce button
          try
            click button "Bounce" of sheet 1 of window 1
          on error
            -- Try alternative UI hierarchy
            try
              click button "OK" of sheet 1 of window 1
            end try
          end try
        end tell
      end tell

      return "bounce_started"
    `;

    try {
      await this.runAppleScript(selectAndBounce, ExportManager.BOUNCE_TIMEOUT_MS);
    } catch (error) {
      throw new Error(
        `Failed to initiate stem export: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Wait for the bounce to complete by polling the output directory
    const exportedFiles = await this.waitForBounceCompletion(outputDir);
    return exportedFiles;
  }

  /**
   * Export a MIDI file from the currently-open Logic Pro project.
   * Uses File > Export > MIDI File...
   */
  async exportMidi(logicxPath: string, outputPath: string): Promise<string> {
    const available = await this.checkLogicProAvailable();
    if (!available) {
      throw new Error(
        "Logic Pro is not running. Please open Logic Pro before exporting MIDI."
      );
    }

    await this.openProject(logicxPath);
    await this.delay(ExportManager.UI_SETTLE_MS * 2);

    const script = `
      tell application "Logic Pro"
        activate
      end tell

      delay 1

      tell application "System Events"
        tell process "Logic Pro"
          -- File > Export > MIDI File...
          click menu item "MIDI File..." of menu "Export" of menu item "Export" of menu "File" of menu bar 1
          delay 1.5

          -- Navigate to the save location
          keystroke "g" using {command down, shift down}
          delay 0.8

          -- Type the output directory
          set parentDir to "${this.parentDir(outputPath).replace(/"/g, '\\"')}"
          set value of text field 1 of sheet 1 of sheet 1 of window 1 to parentDir
          delay 0.3
          keystroke return
          delay 0.5

          -- Set the filename
          set value of text field 1 of sheet 1 of window 1 to "${this.baseName(outputPath).replace(/"/g, '\\"')}"
          delay 0.3

          -- Click Save
          click button "Save" of sheet 1 of window 1
          delay 1
        end tell
      end tell

      return "midi_exported"
    `;

    try {
      await this.runAppleScript(script, 60_000);
      return outputPath;
    } catch (error) {
      throw new Error(
        `Failed to export MIDI: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Export an AAF (Advanced Authoring Format) file from the project.
   * Uses File > Export > AAF File...
   */
  async exportAAF(logicxPath: string, outputPath: string): Promise<string> {
    const available = await this.checkLogicProAvailable();
    if (!available) {
      throw new Error(
        "Logic Pro is not running. Please open Logic Pro before exporting AAF."
      );
    }

    await this.openProject(logicxPath);
    await this.delay(ExportManager.UI_SETTLE_MS * 2);

    const script = `
      tell application "Logic Pro"
        activate
      end tell

      delay 1

      tell application "System Events"
        tell process "Logic Pro"
          -- File > Export > AAF File...
          try
            click menu item "AAF File..." of menu "Export" of menu item "Export" of menu "File" of menu bar 1
          on error
            -- Some Logic versions use "Export as AAF..."
            click menu item "Export as AAF..." of menu "File" of menu bar 1
          end try
          delay 1.5

          -- Navigate to the save location
          keystroke "g" using {command down, shift down}
          delay 0.8

          set parentDir to "${this.parentDir(outputPath).replace(/"/g, '\\"')}"
          set value of text field 1 of sheet 1 of sheet 1 of window 1 to parentDir
          delay 0.3
          keystroke return
          delay 0.5

          -- Set the filename
          set value of text field 1 of sheet 1 of window 1 to "${this.baseName(outputPath).replace(/"/g, '\\"')}"
          delay 0.3

          -- Click Save / Export
          try
            click button "Save" of sheet 1 of window 1
          on error
            try
              click button "Export" of sheet 1 of window 1
            end try
          end try
          delay 2
        end tell
      end tell

      return "aaf_exported"
    `;

    try {
      await this.runAppleScript(script, 120_000);
      return outputPath;
    } catch (error) {
      throw new Error(
        `Failed to export AAF: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Open a .logicx project file in Logic Pro (or bring it to the front if
   * already open).
   */
  private async openProject(logicxPath: string): Promise<void> {
    const script = `
      tell application "Logic Pro"
        activate
        open POSIX file "${logicxPath.replace(/"/g, '\\"')}"
      end tell
    `;

    try {
      await this.runAppleScript(script, 30_000);
    } catch (error) {
      throw new Error(
        `Failed to open project "${logicxPath}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute an AppleScript string via `osascript`.
   */
  private async runAppleScript(
    script: string,
    timeoutMs = 30_000
  ): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync("osascript", ["-e", script], {
      timeout: timeoutMs,
    });
  }

  /**
   * Poll the output directory for new WAV files until the bounce completes.
   */
  private async waitForBounceCompletion(
    outputDir: string
  ): Promise<ExportedFile[]> {
    const startTime = Date.now();
    let previousCount = 0;
    let stableIterations = 0;

    while (Date.now() - startTime < ExportManager.BOUNCE_TIMEOUT_MS) {
      await this.delay(3000);

      try {
        const files = await readdir(outputDir);
        const wavFiles = files.filter(
          (f) => f.toLowerCase().endsWith(".wav") || f.toLowerCase().endsWith(".aif")
        );

        if (wavFiles.length > 0 && wavFiles.length === previousCount) {
          stableIterations++;
          // If the count has been stable for ~9 seconds, assume bounce is done
          if (stableIterations >= 3) {
            return wavFiles.map((fileName, index) => {
              // Try to parse track index and name from the filename pattern
              // Logic Pro typically exports as "TrackName.wav" or "01 TrackName.wav"
              const parsed = this.parseExportedFileName(fileName, index);
              return {
                path: join(outputDir, fileName),
                trackName: parsed.name,
                trackIndex: parsed.index,
              };
            });
          }
        } else {
          stableIterations = 0;
          previousCount = wavFiles.length;
        }
      } catch {
        // Directory might not exist yet
      }
    }

    throw new Error(
      "Stem export timed out. The bounce may still be running in Logic Pro."
    );
  }

  /**
   * Parse an exported filename like "01_Drums.wav" or "Vocals.wav" into
   * a track index and name.
   */
  private parseExportedFileName(
    fileName: string,
    fallbackIndex: number
  ): { index: number; name: string } {
    // Remove extension
    const base = fileName.replace(/\.(wav|aif|aiff)$/i, "");

    // Try pattern: "01_TrackName" or "01 TrackName"
    const match = base.match(/^(\d+)[_\s]+(.+)$/);
    if (match) {
      return {
        index: parseInt(match[1], 10),
        name: match[2].trim(),
      };
    }

    return {
      index: fallbackIndex + 1,
      name: base.trim(),
    };
  }

  /**
   * Infer the track type from its name (heuristic).
   */
  private inferTrackType(
    name: string
  ): "audio" | "software" | "drummer" | "external" | "unknown" {
    const lower = name.toLowerCase();
    if (lower.includes("drummer") || lower.includes("drum machine")) {
      return "drummer";
    }
    if (
      lower.includes("inst") ||
      lower.includes("synth") ||
      lower.includes("piano") ||
      lower.includes("keys") ||
      lower.includes("strings") ||
      lower.includes("pad")
    ) {
      return "software";
    }
    if (
      lower.includes("audio") ||
      lower.includes("vocal") ||
      lower.includes("guitar") ||
      lower.includes("bass") ||
      lower.includes("mic")
    ) {
      return "audio";
    }
    if (lower.includes("ext") || lower.includes("hardware")) {
      return "external";
    }
    return "unknown";
  }

  private parentDir(filePath: string): string {
    const parts = filePath.split("/");
    parts.pop();
    return parts.join("/") || "/";
  }

  private baseName(filePath: string): string {
    return filePath.split("/").pop() ?? filePath;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
