import { watch, FSWatcher } from "fs";
import { stat } from "fs/promises";
import { join } from "path";

interface WatcherOptions {
  debounceMs: number;
  onStable: () => void | Promise<void>;
  ignorePatterns?: string[];
}

const DEFAULT_IGNORE = [
  ".DS_Store",
  "Thumbs.db",
  ".git",
  "node_modules",
  // Logic Pro temp/lock files
  ".pfl",
  "projectData.lock",
];

export class Watcher {
  private fsWatcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private projectPath: string;
  private options: WatcherOptions;
  private isWatching = false;

  constructor(projectPath: string, options: WatcherOptions) {
    this.projectPath = projectPath;
    this.options = options;
  }

  start() {
    if (this.isWatching) return;

    this.fsWatcher = watch(
      this.projectPath,
      { recursive: true },
      (eventType, filename) => {
        if (!filename) return;

        // Check ignore patterns
        const ignorePatterns = this.options.ignorePatterns ?? DEFAULT_IGNORE;
        if (ignorePatterns.some((pattern) => filename.includes(pattern))) {
          return;
        }

        this.scheduleStableCallback();
      }
    );

    this.isWatching = true;
  }

  stop() {
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isWatching = false;
  }

  private scheduleStableCallback() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      try {
        await this.options.onStable();
      } catch (error) {
        console.error("[Watcher] Error in stable callback:", error);
      }
    }, this.options.debounceMs);
  }

  get watching() {
    return this.isWatching;
  }
}
