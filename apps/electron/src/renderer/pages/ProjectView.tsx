import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { computeManifestDiff } from "@artistry/shared";
import type { ManifestEntry, DiffEntry, VersionManifest } from "@artistry/shared";
import {
  cn,
  formatBytes,
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  DiffList,
  DiffSummary,
} from "@artistry/ui";

const api = (window as any).artistry;

interface Version {
  _id: string;
  versionNumber: number;
  message?: string;
  status: string;
  fileCount: number;
  totalSize: number;
  manifest: ManifestEntry[];
  creatorName: string;
  _creationTime: number;
}

interface ProjectViewPageProps {
  songId: string;
  songTitle: string;
  onBack: () => void;
}

type LocalStatus =
  | { state: "idle" }
  | { state: "analyzing" }
  | { state: "synced"; fileCount: number; totalSize: number }
  | {
      state: "ahead";
      diff: { entries: DiffEntry[]; summary: { added: number; removed: number; modified: number; renamed: number } };
      localManifest: VersionManifest;
    }
  | { state: "error"; message: string };

type PushState =
  | { phase: "idle" }
  | { phase: "snapshotting" }
  | { phase: "uploading"; current: number; total: number }
  | { phase: "completing" }
  | { phase: "done"; versionNumber: number }
  | { phase: "error"; message: string };

interface ProjectState {
  projectPath: string;
  linkedAt: number;
  pathMissing: boolean;
  localStatus: LocalStatus;
  pushState: PushState;
  pushMessage: string;
  showDiff: boolean;
}

export function ProjectViewPage({
  songId,
  songTitle,
  onBack,
}: ProjectViewPageProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Map<string, ProjectState>>(new Map());
  const [initialLoading, setInitialLoading] = useState(true);
  const [showPull, setShowPull] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const latestVersionRef = useRef<Version | null>(null);

  const loadVersions = useCallback(async () => {
    try {
      const result = await api.convex.query(
        "logicProjectVersions:listBySong",
        { songId }
      );
      const sorted = (result ?? []) as Version[];
      setVersions(sorted);
      if (sorted.length > 0) {
        latestVersionRef.current = sorted[0];
      }
    } catch (err) {
      console.error("Failed to load versions:", err);
    } finally {
      setLoading(false);
    }
  }, [songId]);

  const compareWithOnline = useCallback(
    (localManifest: VersionManifest) => {
      const latest = latestVersionRef.current;
      if (!latest || latest.status !== "ready") {
        return {
          state: "ahead" as const,
          diff: computeManifestDiff([], localManifest.entries),
          localManifest,
        };
      }

      const diff = computeManifestDiff(latest.manifest, localManifest.entries);

      if (diff.entries.length === 0) {
        return {
          state: "synced" as const,
          fileCount: localManifest.fileCount,
          totalSize: localManifest.totalSize,
        };
      }
      return { state: "ahead" as const, diff, localManifest };
    },
    []
  );

  const analyzeProject = useCallback(
    async (projectPath: string) => {
      setProjects((prev) => {
        const next = new Map(prev);
        const existing = next.get(projectPath);
        if (existing) {
          next.set(projectPath, { ...existing, localStatus: { state: "analyzing" } });
        }
        return next;
      });

      try {
        const { manifest } = await api.project.analyzeLocal(songId, projectPath);
        const status = compareWithOnline(manifest);
        setProjects((prev) => {
          const next = new Map(prev);
          const existing = next.get(projectPath);
          if (existing) {
            next.set(projectPath, { ...existing, localStatus: status });
          }
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Analysis failed";
        setProjects((prev) => {
          const next = new Map(prev);
          const existing = next.get(projectPath);
          if (existing) {
            next.set(projectPath, { ...existing, localStatus: { state: "error", message: msg } });
          }
          return next;
        });
      }
    },
    [songId, compareWithOnline]
  );

  // Load linked projects on mount
  useEffect(() => {
    (async () => {
      const links = await api.project.getLinks(songId);
      const map = new Map<string, ProjectState>();
      for (const link of links) {
        map.set(link.projectPath, {
          projectPath: link.projectPath,
          linkedAt: link.linkedAt,
          pathMissing: link.pathMissing,
          localStatus: { state: "idle" },
          pushState: { phase: "idle" },
          pushMessage: "",
          showDiff: false,
        });
      }
      setProjects(map);
      setInitialLoading(false);
    })();
  }, [songId]);

  // Start watchers + analyze for non-missing projects
  useEffect(() => {
    if (initialLoading) return;

    for (const [projectPath, proj] of projects) {
      if (!proj.pathMissing) {
        analyzeProject(projectPath);
        api.watcher.start(projectPath, songId);
      }
    }

    return () => {
      for (const [projectPath, proj] of projects) {
        if (!proj.pathMissing) {
          api.watcher.stop(projectPath);
        }
      }
    };
    // Only run on initial load or when project set changes (keyed by paths)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoading, [...projects.keys()].join(",")]);

  // Watcher onChange — match by projectPath
  useEffect(() => {
    const removeListener = api.watcher.onChange(
      (data: { songId: string; projectPath: string; manifest?: VersionManifest }) => {
        if (data.songId !== songId) return;
        if (data.manifest) {
          const status = compareWithOnline(data.manifest);
          setProjects((prev) => {
            const next = new Map(prev);
            const existing = next.get(data.projectPath);
            if (existing) {
              next.set(data.projectPath, { ...existing, localStatus: status });
            }
            return next;
          });
        } else {
          analyzeProject(data.projectPath);
        }
      }
    );
    return removeListener;
  }, [songId, compareWithOnline, analyzeProject]);

  // Load versions + push progress listener
  useEffect(() => {
    loadVersions();
    const interval = setInterval(loadVersions, 5000);
    const removePushListener = api.project.onPushProgress(
      (data: { songId: string; phase: string; current: number; total: number }) => {
        if (data.songId !== songId) return;
        // Update push state for all projects that are currently pushing
        setProjects((prev) => {
          const next = new Map(prev);
          for (const [path, proj] of next) {
            if (proj.pushState.phase === "snapshotting" || proj.pushState.phase === "uploading") {
              next.set(path, {
                ...proj,
                pushState: { phase: "uploading", current: data.current, total: data.total },
              });
            }
          }
          return next;
        });
      }
    );
    return () => {
      clearInterval(interval);
      removePushListener();
    };
  }, [songId, loadVersions]);

  const handleLink = async () => {
    const result = await api.project.link(songId);
    if (!result) return;
    const projectPath = result.projectPath;

    setProjects((prev) => {
      const next = new Map(prev);
      next.set(projectPath, {
        projectPath,
        linkedAt: result.linkedAt,
        pathMissing: false,
        localStatus: { state: "idle" },
        pushState: { phase: "idle" },
        pushMessage: "",
        showDiff: false,
      });
      return next;
    });

    // Start watching and analyzing
    analyzeProject(projectPath);
    api.watcher.start(projectPath, songId);
  };

  const handleUnlink = async (projectPath: string) => {
    await api.project.unlink(songId, projectPath);
    api.watcher.stop(projectPath);
    setProjects((prev) => {
      const next = new Map(prev);
      next.delete(projectPath);
      return next;
    });
  };

  const handleRelink = async (oldPath: string) => {
    // Unlink the old one first
    await api.project.unlink(songId, oldPath);
    setProjects((prev) => {
      const next = new Map(prev);
      next.delete(oldPath);
      return next;
    });
    // Then link a new one
    handleLink();
  };

  const handlePush = async (projectPath: string) => {
    updateProject(projectPath, { pushState: { phase: "snapshotting" } });

    const result = await api.project.push({
      songId,
      projectPath,
      message: projects.get(projectPath)?.pushMessage?.trim() || undefined,
    });

    if (result.success) {
      updateProject(projectPath, {
        pushState: { phase: "done", versionNumber: result.versionNumber },
        pushMessage: "",
      });
      loadVersions();
      setTimeout(() => {
        updateProject(projectPath, { pushState: { phase: "idle" } });
        analyzeProject(projectPath);
      }, 2000);
    } else {
      updateProject(projectPath, {
        pushState: { phase: "error", message: result.error },
      });
    }
  };

  const updateProject = (projectPath: string, updates: Partial<ProjectState>) => {
    setProjects((prev) => {
      const next = new Map(prev);
      const existing = next.get(projectPath);
      if (existing) {
        next.set(projectPath, { ...existing, ...updates });
      }
      return next;
    });
  };

  const handlePull = async () => {
    if (!selectedVersionId) return;
    const targetPath = await api.fs.selectSaveLocation(`${songTitle}.logicx`);
    if (!targetPath) return;
    const result = await api.project.pull({
      versionId: selectedVersionId,
      targetPath,
    });
    if (result.success) {
      setShowPull(false);
      setSelectedVersionId(null);
    }
  };

  const latestVersion = versions[0];
  const latestVersionNumber = latestVersion?.versionNumber ?? 0;
  const projectEntries = Array.from(projects.entries());

  return (
    <div className="p-6 pt-10">
      {/* Header */}
      <div className="mb-5">
        <Button
          variant="link"
          size="xs"
          className="mb-2 gap-1 px-0 text-muted-foreground"
          onClick={onBack}
        >
          <ChevronLeft className="size-3" />
          Back to songs
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">{songTitle}</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPull(!showPull)}>
              Pull
            </Button>
            <Button size="sm" onClick={handleLink}>
              Link .logicx
            </Button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {initialLoading && (
        <Card className="mb-3 py-0">
          <CardContent className="py-3">
            <div className="text-sm text-muted-foreground">
              Checking project links...
            </div>
          </CardContent>
        </Card>
      )}

      {/* No projects linked */}
      {!initialLoading && projectEntries.length === 0 && (
        <Card className="mb-3 py-0">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                No projects linked
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-project cards */}
      {projectEntries.map(([projectPath, proj]) => {
        const isPushing =
          proj.pushState.phase !== "idle" &&
          proj.pushState.phase !== "done" &&
          proj.pushState.phase !== "error";

        return (
          <div key={projectPath} className="mb-3">
            <Card className="py-0">
              <CardContent className="py-3">
                {proj.pathMissing ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-destructive">
                        Project not found
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {projectPath}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => handleRelink(projectPath)}>
                        Re-link
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-muted-foreground"
                        onClick={() => handleUnlink(projectPath)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        {proj.localStatus.state === "analyzing" && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            Analyzing project...
                          </div>
                        )}

                        {proj.localStatus.state === "synced" && (
                          <div className="text-sm">
                            <span className="font-medium text-green-600 dark:text-green-400">
                              Matches v{latestVersionNumber}
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              {proj.localStatus.fileCount} files &middot;{" "}
                              {formatBytes(proj.localStatus.totalSize)}
                            </span>
                          </div>
                        )}

                        {proj.localStatus.state === "ahead" && (
                          <div className="text-sm">
                            <span className="font-medium">
                              Local changes
                              {latestVersionNumber > 0
                                ? ` vs v${latestVersionNumber}`
                                : ""}
                            </span>
                            <DiffSummary
                              summary={proj.localStatus.diff.summary}
                              className="mt-1"
                            />
                          </div>
                        )}

                        {proj.localStatus.state === "error" && (
                          <div className="text-sm text-destructive">
                            {proj.localStatus.message}
                          </div>
                        )}

                        {proj.localStatus.state === "idle" && (
                          <div className="text-sm text-muted-foreground">Linked</div>
                        )}
                      </div>

                      <div className="flex shrink-0 gap-1.5">
                        {proj.localStatus.state === "ahead" && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              updateProject(projectPath, { showDiff: !proj.showDiff })
                            }
                          >
                            {proj.showDiff ? "Hide diff" : "Show diff"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-muted-foreground"
                          onClick={() => handleUnlink(projectPath)}
                        >
                          Unlink
                        </Button>
                      </div>
                    </div>

                    <div className="mt-1.5 truncate text-[11px] text-muted-foreground">
                      {projectPath}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Diff for this project */}
            {proj.showDiff && proj.localStatus.state === "ahead" && (
              <div className="mt-1.5">
                <DiffList
                  entries={proj.localStatus.diff.entries}
                  summary={proj.localStatus.diff.summary}
                  title={`Changes (${proj.localStatus.diff.entries.length} files)`}
                  maxHeight={300}
                />
              </div>
            )}

            {/* Push controls for this project */}
            {!proj.pathMissing && proj.localStatus.state === "ahead" && (
              <Card className="mt-1.5 py-0">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={proj.pushMessage}
                      onChange={(e) =>
                        updateProject(projectPath, { pushMessage: e.target.value })
                      }
                      placeholder="Version message (optional)"
                      disabled={isPushing}
                    />
                    <Button
                      size="sm"
                      onClick={() => handlePush(projectPath)}
                      disabled={isPushing}
                    >
                      Push v{latestVersionNumber + 1}
                    </Button>
                  </div>
                  {proj.pushState.phase !== "idle" && (
                    <div
                      className={cn(
                        "mt-2 text-xs",
                        proj.pushState.phase === "error"
                          ? "text-destructive"
                          : proj.pushState.phase === "done"
                            ? "font-medium text-green-600 dark:text-green-400"
                            : "text-muted-foreground"
                      )}
                    >
                      {proj.pushState.phase === "snapshotting" && "Creating snapshot..."}
                      {proj.pushState.phase === "uploading" &&
                        `Uploading ${proj.pushState.current}/${proj.pushState.total}...`}
                      {proj.pushState.phase === "completing" && "Finalizing..."}
                      {proj.pushState.phase === "done" && `v${proj.pushState.versionNumber} pushed!`}
                      {proj.pushState.phase === "error" && proj.pushState.message}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}

      {/* Pull Dialog */}
      {showPull && (
        <Card className="mb-3 py-0">
          <CardContent className="space-y-3 py-4">
            <div className="text-sm font-medium">Pull Version</div>
            <select
              value={selectedVersionId ?? ""}
              onChange={(e) => setSelectedVersionId(e.target.value || null)}
              className="border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">Select a version...</option>
              {versions
                .filter((v) => v.status === "ready")
                .map((v) => (
                  <option key={v._id} value={v._id}>
                    v{v.versionNumber}
                    {v.message ? ` — ${v.message}` : ""} (
                    {formatBytes(v.totalSize)})
                  </option>
                ))}
            </select>
            <Button
              size="sm"
              onClick={handlePull}
              disabled={!selectedVersionId}
            >
              Select Location & Pull
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Version Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : versions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No versions yet.{" "}
          {projectEntries.length > 0
            ? "Push your first version."
            : "Link a .logicx project to get started."}
        </div>
      ) : (
        <div className="rounded-xl border shadow-sm">
          {versions.map((version, i) => (
            <div
              key={version._id}
              className={cn(
                "flex items-center justify-between p-4",
                i < versions.length - 1 && "border-b"
              )}
            >
              <div>
                <div className="text-sm">
                  <span className="font-medium">v{version.versionNumber}</span>
                  {version.message && (
                    <span className="text-muted-foreground">
                      {" "}
                      &mdash; {version.message}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {version.fileCount} files &middot;{" "}
                  {formatBytes(version.totalSize)} &middot;{" "}
                  {version.creatorName} &middot;{" "}
                  {new Date(version._creationTime).toLocaleDateString()}
                </div>
              </div>
              <Badge
                variant={
                  version.status === "ready"
                    ? "secondary"
                    : version.status === "error"
                      ? "destructive"
                      : "outline"
                }
              >
                {version.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
