// Logic Pro versioning types

export interface ManifestEntry {
  path: string;
  sha256: string;
  size: number;
  mtime: number;
}

export interface VersionManifest {
  entries: ManifestEntry[];
  totalSize: number;
  fileCount: number;
}

export interface DiffEntry {
  path: string;
  type: "added" | "removed" | "modified" | "renamed";
  oldPath?: string;
  oldSha256?: string;
  newSha256?: string;
  oldSize?: number;
  newSize?: number;
}

export interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  entries: DiffEntry[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    renamed: number;
  };
}

export type VersionStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "error";

export type ProcessingJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type ReviewStatus =
  | "pending"
  | "approved"
  | "changes_requested";

export { computeManifestDiff } from "./manifest-diff";
