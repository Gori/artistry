"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import {
  Clock,
  FileStack,
  HardDrive,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatBytes, DiffSummary } from "@artistry/ui";
import { DiffPanel } from "./diff-panel";
import { DownloadDialog } from "./download-dialog";
import { CommentsPanel } from "./comments-panel";
import { ReviewPanel } from "./review-panel";
import { PlaybackPanel } from "./playback-panel";
import { StemCompare } from "./stem-compare";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface Version {
  _id: Id<"logicProjectVersions">;
  versionNumber: number;
  message?: string;
  creatorName: string;
  status: string;
  fileCount: number;
  totalSize: number;
  _creationTime: number;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return <CheckCircle className="size-4 text-green-500" />;
    case "error":
      return <AlertCircle className="size-4 text-destructive" />;
    case "uploading":
    case "processing":
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
    default:
      return null;
  }
}

function ConnectedDiffSummary({
  fromVersionId,
  toVersionId,
}: {
  fromVersionId: Id<"logicProjectVersions">;
  toVersionId: Id<"logicProjectVersions">;
}) {
  const diff = useQuery(api.logicDiffs.getByVersions, {
    fromVersionId,
    toVersionId,
  });

  if (!diff) return null;

  return <DiffSummary summary={diff.summary} className="mt-2" />;
}

export function VersionTimeline({
  versions,
  songId,
}: {
  versions: Version[];
  songId: Id<"songs">;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

      <div className="space-y-0">
        {versions.map((version, index) => {
          const isExpanded = expandedId === version._id;
          const prevVersion = versions[index + 1]; // versions are sorted desc

          return (
            <div key={version._id} className="relative pl-10">
              {/* Timeline dot */}
              <div
                className={cn(
                  "absolute left-[15px] top-4 size-2.5 rounded-full border-2 bg-background",
                  version.status === "ready"
                    ? "border-green-500"
                    : version.status === "error"
                      ? "border-destructive"
                      : "border-muted-foreground"
                )}
              />

              <button
                className="w-full rounded-lg p-3 text-left transition-colors hover:bg-accent/50"
                onClick={() =>
                  setExpandedId(isExpanded ? null : version._id)
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={version.status} />
                    <span className="font-medium">
                      v{version.versionNumber}
                    </span>
                    {version.message && (
                      <span className="text-sm text-muted-foreground">
                        &mdash; {version.message}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {version.status}
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatDate(version._creationTime)}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileStack className="size-3" />
                    {version.fileCount} files
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="size-3" />
                    {formatBytes(version.totalSize)}
                  </span>
                  <span>{version.creatorName}</span>
                </div>

                {/* Show diff summary inline */}
                {prevVersion && version.status === "ready" && (
                  <ConnectedDiffSummary
                    fromVersionId={prevVersion._id}
                    toVersionId={version._id}
                  />
                )}
              </button>

              {isExpanded && (
                <div className="mx-3 mb-3 space-y-3">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        <p>
                          Uploaded by {version.creatorName} on{" "}
                          {new Date(version._creationTime).toLocaleString()}
                        </p>
                        {version.status === "error" && (
                          <p className="mt-2 text-destructive">
                            Processing failed. Try uploading again.
                          </p>
                        )}
                      </div>
                      {version.status === "ready" && (
                        <DownloadDialog
                          versionId={version._id}
                          versionNumber={version.versionNumber}
                        />
                      )}
                    </div>
                  </div>

                  <Tabs defaultValue="diff">
                    <TabsList variant="line" className="w-full justify-start">
                      <TabsTrigger value="diff">Diff</TabsTrigger>
                      <TabsTrigger value="comments">Comments</TabsTrigger>
                      <TabsTrigger value="review">Review</TabsTrigger>
                      <TabsTrigger value="audio">Audio</TabsTrigger>
                    </TabsList>

                    <TabsContent value="diff" className="mt-3">
                      {prevVersion && version.status === "ready" ? (
                        <>
                          <DiffPanel
                            fromVersionId={prevVersion._id}
                            toVersionId={version._id}
                            fromVersionNumber={prevVersion.versionNumber}
                            toVersionNumber={version.versionNumber}
                          />
                          <div className="mt-3">
                            <StemCompare
                              versionAId={prevVersion._id}
                              versionBId={version._id}
                              versionANumber={prevVersion.versionNumber}
                              versionBNumber={version.versionNumber}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                          {version.status !== "ready"
                            ? "Diff not available — version is still processing."
                            : "This is the first version. No previous version to diff against."}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="comments" className="mt-3">
                      <CommentsPanel
                        versionId={version._id}
                        songId={songId}
                      />
                    </TabsContent>

                    <TabsContent value="review" className="mt-3">
                      <ReviewPanel
                        versionId={version._id}
                        songId={songId}
                      />
                    </TabsContent>

                    <TabsContent value="audio" className="mt-3">
                      <PlaybackPanel versionId={version._id} />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
