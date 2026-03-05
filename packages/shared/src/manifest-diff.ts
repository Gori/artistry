import type { ManifestEntry, DiffEntry } from "./index";

/**
 * Compute a file-level diff between two manifests by comparing path + sha256.
 * Detects added, removed, modified, and renamed files.
 */
export function computeManifestDiff(
  from: ManifestEntry[],
  to: ManifestEntry[]
): { entries: DiffEntry[]; summary: { added: number; removed: number; modified: number; renamed: number } } {
  const fromByPath = new Map(from.map((e) => [e.path, e]));
  const toByPath = new Map(to.map((e) => [e.path, e]));

  // Build hash-to-paths for rename detection
  const fromByHash = new Map<string, string[]>();
  for (const entry of from) {
    const paths = fromByHash.get(entry.sha256) ?? [];
    paths.push(entry.path);
    fromByHash.set(entry.sha256, paths);
  }

  const diffEntries: DiffEntry[] = [];
  const handledFromPaths = new Set<string>();

  // Find added, modified, and renamed files
  for (const [path, toEntry] of toByPath) {
    const fromEntry = fromByPath.get(path);

    if (!fromEntry) {
      // Check if this is a rename (same hash exists in old version under different path)
      const oldPaths = fromByHash.get(toEntry.sha256);
      const renamedFrom = oldPaths?.find(
        (oldPath) => oldPath !== path && !toByPath.has(oldPath)
      );

      if (renamedFrom) {
        diffEntries.push({
          path,
          type: "renamed",
          oldPath: renamedFrom,
          oldSha256: toEntry.sha256,
          newSha256: toEntry.sha256,
          oldSize: toEntry.size,
          newSize: toEntry.size,
        });
        handledFromPaths.add(renamedFrom);
      } else {
        diffEntries.push({
          path,
          type: "added",
          newSha256: toEntry.sha256,
          newSize: toEntry.size,
        });
      }
    } else if (fromEntry.sha256 !== toEntry.sha256) {
      diffEntries.push({
        path,
        type: "modified",
        oldSha256: fromEntry.sha256,
        newSha256: toEntry.sha256,
        oldSize: fromEntry.size,
        newSize: toEntry.size,
      });
      handledFromPaths.add(path);
    } else {
      // Unchanged
      handledFromPaths.add(path);
    }
  }

  // Find removed files
  for (const [path, fromEntry] of fromByPath) {
    if (!toByPath.has(path) && !handledFromPaths.has(path)) {
      diffEntries.push({
        path,
        type: "removed",
        oldSha256: fromEntry.sha256,
        oldSize: fromEntry.size,
      });
    }
  }

  const summary = {
    added: diffEntries.filter((e) => e.type === "added").length,
    removed: diffEntries.filter((e) => e.type === "removed").length,
    modified: diffEntries.filter((e) => e.type === "modified").length,
    renamed: diffEntries.filter((e) => e.type === "renamed").length,
  };

  return { entries: diffEntries, summary };
}
